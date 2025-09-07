import { claude } from '@lasercat/claude-code-sdk-ts';
import type { Message } from '@lasercat/claude-code-sdk-ts';
import type { WebSocket, WebSocketMessage } from '@shared/types';
import type { SpawnClaudeOptions } from '@shared/claude/types';
import { promises as fs } from 'fs';
import path from 'path';
import { Duplex, Writable } from 'stream';

// Type guard to check if output is a WebSocket
function isWebSocket(output: WebSocket | Writable | Duplex): output is WebSocket {
  return 'send' in output && typeof (output as WebSocket).send === 'function';
}

// Type guard to check if output is a Duplex stream
function isDuplexStream(output: WebSocket | Writable | Duplex): output is Duplex {
  return output instanceof Duplex;
}

// Helper function to send data to either WebSocket or Stream
function sendMessage(output: WebSocket | Writable | Duplex, message: WebSocketMessage): void {
  const jsonString = JSON.stringify(message);

  if (isWebSocket(output)) {
    output.send(jsonString);
  } else if (isDuplexStream(output)) {
    // For duplex streams, write to the writable side
    output.write(jsonString + '\n');
  } else {
    // For writable streams
    (output as Writable).write(jsonString + '\n');
  }
}

const activeClaudeControllers = new Map<string, AbortController>(); // Track active abort controllers by session ID

// export interface SpawnClaudeOptions {
//   sessionId?: string;
//   projectPath?: string; // Not used in refactored version but kept for API compatibility
//   cwd?: string;
//   resume?: boolean;
//   toolsSettings?: ToolsSettings;
//   permissionMode?: PermissionMode; // 'default' | 'acceptEdits' | 'bypassPermissions'
//   images?: ImageData[];
// }
/**
 * Spawns a Claude session using the SDK
 * @param command - The command/prompt to send to Claude
 * @param options - Configuration options
 * @param output - WebSocket, Writable stream, or Duplex stream for output
 * @returns The final session ID used for this interaction
 */
async function spawnClaude(
  command: string,
  options: SpawnClaudeOptions = {},
  output: WebSocket | Writable | Duplex,
): Promise<string | undefined> {
  const { sessionId, cwd, toolsSettings, permissionMode, images } = options;
  let capturedSessionId = sessionId; // Track session ID throughout the process
  let sessionCreatedSent = false; // Track if we've already sent session-created event

  try {
    // Use tools settings passed from frontend, or defaults
    const settings = toolsSettings || {
      allowedTools: [],
      disallowedTools: [],
      skipPermissions: false,
    };

    // Use cwd (actual project directory) instead of projectPath (Claude's metadata directory)
    const workingDir = cwd || process.cwd();

    // Handle images by saving them to temporary files and passing paths to Claude
    const tempImagePaths: string[] = [];
    let tempDir: string | null = null;
    let modifiedCommand = command;

    if (images && images.length > 0) {
      try {
        // Create temp directory in the project directory so Claude can access it
        tempDir = path.join(workingDir, '.tmp', 'images', Date.now().toString());
        await fs.mkdir(tempDir, { recursive: true });

        // Save each image to a temp file
        for (const [index, image] of images.entries()) {
          // Extract base64 data and mime type
          const matches = image.data.match(/^data:([^;]+);base64,(.+)$/);
          if (!matches) {
            console.error('Invalid image data format');
            continue;
          }

          const [, mimeType, base64Data] = matches;
          const extension = mimeType ? mimeType.split('/')[1] || 'png' : 'png';
          const filename = `image_${index}.${extension}`;
          const filepath = path.join(tempDir, filename);

          // Write base64 data to file
          if (base64Data) {
            await fs.writeFile(filepath, Buffer.from(base64Data, 'base64'));
            tempImagePaths.push(filepath);
          }
        }

        // Include the full image paths in the prompt for Claude to reference
        // Only modify the command if we actually have images and a command
        if (tempImagePaths.length > 0 && command && command.trim()) {
          const imageNote = `\n\n[Images provided at the following paths:]\n${tempImagePaths.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
          modifiedCommand = command + imageNote;
        }
      } catch (error) {
        console.error('Error processing images for Claude:', error);
      }
    }

    // Create abort controller for cancellation
    const controller = new AbortController();
    const processKey = capturedSessionId || Date.now().toString();
    activeClaudeControllers.set(processKey, controller);

    // Build the query using the SDK
    let query = claude().inDirectory(workingDir).withSignal(controller.signal);

    // If we have a sessionId, use it to resume the session
    // Otherwise, start a new session with a model
    if (sessionId) {
      // Resume existing session using the provided session ID
      query = query.withSessionId(sessionId);
    } else {
      // New session - set model
      query = query.withModel('claude-opus-4-20250514');
    }

    // Configure permission mode based on SDK's PermissionMode
    if (permissionMode === 'acceptEdits' || permissionMode === 'bypassPermissions') {
      query = query.skipPermissions();
    }

    // Configure tools
    if (settings.skipPermissions) {
      query = query.skipPermissions();
    } else {
      // Apply allowed tools
      if (settings.allowedTools && settings.allowedTools.length > 0) {
        query = query.allowTools(...settings.allowedTools);
      }

      // Apply disallowed tools
      if (settings.disallowedTools && settings.disallowedTools.length > 0) {
        query = query.denyTools(...settings.disallowedTools);
      }
    }

    // Set up message handlers to stream responses
    query = query
      .onMessage((msg: Message) => {
        // Send message to output
        sendMessage(output, {
          type: 'claude-response',
          data: msg,
        });
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .onAssistant((content: any) => {
        sendMessage(output, {
          type: 'claude-response',
          data: content,
        });
      })
      .onToolUse((tool: unknown) => {
        sendMessage(output, {
          type: 'claude-response',
          data: { type: 'tool_use', tool },
        });
      });

    // Execute the query and get the response parser
    const responseParser = query.query(modifiedCommand || '');

    // Stream the messages
    await responseParser.stream(async () => {
      // Additional streaming handler if needed
      // The main handling is done in onMessage/onAssistant/onToolUse
    });

    // Handle session ID management
    try {
      const sdkSessionId = await responseParser.getSessionId();

      if (sdkSessionId && sdkSessionId !== sessionId) {
        // SDK created a new session instead of resuming the one we requested
        capturedSessionId = sdkSessionId;

        // Update controller key with new session ID
        if (processKey !== capturedSessionId && capturedSessionId) {
          activeClaudeControllers.delete(processKey);
          activeClaudeControllers.set(capturedSessionId, controller);
        }

        // Send session-created event since we got a different session than requested
        if (!sessionCreatedSent) {
          sessionCreatedSent = true;
          console.log(`sending session created with id ${capturedSessionId}`);
          sendMessage(output, {
            type: 'session-created',
            sessionId: capturedSessionId,
          });
        }
      } else {
        // Session ID matches what we requested - successful resume
        capturedSessionId = sessionId;
      }
    } catch {
      // If we can't get session ID, use the one we have
      capturedSessionId = sessionId || capturedSessionId;
    }

    // Clean up controller reference
    const finalSessionId = capturedSessionId || processKey;
    activeClaudeControllers.delete(finalSessionId);

    // Send completion message
    sendMessage(output, {
      type: 'claude-complete',
      exitCode: 0,
      isNewSession: !sessionId && !!command, // Flag to indicate this was a new session
      sessionId: capturedSessionId, // Include the session ID in completion
    });

    // Clean up temporary image files if any
    if (tempImagePaths.length > 0) {
      for (const imagePath of tempImagePaths) {
        await fs
          .unlink(imagePath)
          .catch((err) => console.error(`Failed to delete temp image ${imagePath}:`, err));
      }
      if (tempDir) {
        await fs
          .rm(tempDir, { recursive: true, force: true })
          .catch((err) => console.error(`Failed to delete temp directory ${tempDir}:`, err));
      }
    }

    // Return the final session ID
    return capturedSessionId;
  } catch (error) {
    // Clean up controller reference on error
    const finalSessionId = capturedSessionId || Date.now().toString();
    activeClaudeControllers.delete(finalSessionId);

    // Send error to output
    sendMessage(output, {
      type: 'claude-error',
      error: (error as Error).message || 'Unknown error occurred',
    });

    // Send completion with error code
    sendMessage(output, {
      type: 'claude-complete',
      exitCode: 1,
      isNewSession: !sessionId && !!command,
    });

    throw error;
  }
}

/**
 * Aborts an active Claude session
 */
function abortClaudeSession(sessionId: string): boolean {
  const controller = activeClaudeControllers.get(sessionId);
  if (controller) {
    controller.abort();
    activeClaudeControllers.delete(sessionId);
    return true;
  }
  return false;
}

// Helper function to create a stream wrapper for WebSocket compatibility
function createStreamWrapper(): {
  stream: Duplex;
  onMessage: (handler: (msg: WebSocketMessage) => void) => void;
} {
  const handlers: ((msg: WebSocketMessage) => void)[] = [];

  const stream = new Duplex({
    write(chunk: Buffer | string, _encoding: string, callback: (error?: Error | null) => void) {
      try {
        const lines = chunk
          .toString()
          .split('\n')
          .filter((line: string) => line.trim());
        for (const line of lines) {
          const message = JSON.parse(line) as WebSocketMessage;
          handlers.forEach((handler) => handler(message));
        }
        callback();
      } catch (error) {
        callback(error as Error);
      }
    },
    read() {
      // Reading is handled by the write side
    },
  });

  return {
    stream,
    onMessage: (handler: (msg: WebSocketMessage) => void) => {
      handlers.push(handler);
    },
  };
}

export {
  spawnClaude,
  abortClaudeSession,
  createStreamWrapper,
};
