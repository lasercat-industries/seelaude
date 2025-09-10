import {
  query,
  type Options,
  type PermissionResult,
  type PermissionUpdate,
  type SDKUserMessage,
} from '@anthropic-ai/claude-code';
import type { WebSocket, WebSocketMessage } from '@shared/types';
import { isApprovableTool } from '@shared/claude/types';
import { Duplex, Writable } from 'stream';
import { v4 as uuidv4 } from 'uuid';

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

const pendingPermissionRequests = new Map<
  string,
  {
    requestId: string;
    sessionId: string;
    resolve: (result: PermissionResult) => void;
    timeout: ReturnType<typeof setTimeout>;
  }
>();

// Export a function to handle incoming permission responses
export function handlePermissionResponse(
  sessionId: string,
  requestId: string,
  response: PermissionResult,
) {
  // Look up by composite key or iterate to find matching session
  for (const [key, pending] of pendingPermissionRequests) {
    if (pending.sessionId === sessionId && pending.requestId === requestId) {
      console.log('Resolving permission request:', { sessionId, requestId, response });
      clearTimeout(pending.timeout);
      pending.resolve(response);
      pendingPermissionRequests.delete(key);
      return true;
    }
  }
  console.warn(
    `No pending permission request found for session ${sessionId}, request ${requestId}`,
  );
  return false;
}

const activeClaudeControllers = new Map<string, AbortController>(); // Track active abort controllers by session ID

/**
 * Spawns a Claude session using the Anthropic SDK
 * Note: Images are currently disabled as we will need to refactor to use streaming input to support them
 * @param command - The command/prompt to send to Claude
 * @param options - Configuration options
 * @param output - WebSocket, Writable stream, or Duplex stream for output
 * @returns The final session ID used for this interaction
 */
async function spawnClaude(
  command: string,
  options: Options = {},
  output: WebSocket | Writable | Duplex,
): Promise<string | undefined> {
  const {
    resume,
    cwd,
    allowedTools,
    disallowedTools,
    permissionMode,
    model,
    executable,
    additionalDirectories,
  } = options;
  let capturedSessionId = resume; // Track session ID throughout the process
  let sessionCreatedSent = false; // Track if we've already sent session-created event

  console.log('\n========== SPAWN CLAUDE NEW (ANTHROPIC SDK) ==========');
  console.log('Input Command:', command);
  console.log('Options:', {
    sessionId: resume,
    cwd,
    permissionMode,
    allowedTools,
    disallowedTools,
    model,
    executable,
    additionalDirectories,
  });

  try {
    // Use tools settings passed from frontend, or defaults
    // const settings = toolsSettings || {
    //   allowedTools: [],
    //   disallowedTools: [],
    //   skipPermissions: false,
    // };

    // Use cwd (actual project directory) instead of projectPath (Claude's metadata directory)
    const workingDir = cwd || process.cwd();

    // Note: images are currently disabled
    // Handle images by saving them to temporary files and passing paths to Claude
    // const tempImagePaths: string[] = [];
    // let tempDir: string | null = null;
    // let modifiedCommand = command;

    // if (images && images.length > 0) {
    //   try {
    //     // Create temp directory in the project directory so Claude can access it
    //     tempDir = path.join(workingDir, '.tmp', 'images', Date.now().toString());
    //     await fs.mkdir(tempDir, { recursive: true });

    //     // Save each image to a temp file
    //     for (const [index, image] of images.entries()) {
    //       // Extract base64 data and mime type
    //       const matches = image.data.match(/^data:([^;]+);base64,(.+)$/);
    //       if (!matches) {
    //         console.error('Invalid image data format');
    //         continue;
    //       }

    //       const [, mimeType, base64Data] = matches;
    //       const extension = mimeType ? mimeType.split('/')[1] || 'png' : 'png';
    //       const filename = `image_${index}.${extension}`;
    //       const filepath = path.join(tempDir, filename);

    //       // Write base64 data to file
    //       if (base64Data) {
    //         await fs.writeFile(filepath, Buffer.from(base64Data, 'base64'));
    //         tempImagePaths.push(filepath);
    //       }
    //     }

    //     // Include the full image paths in the prompt for Claude to reference
    //     // Only modify the command if we actually have images and a command
    //     if (tempImagePaths.length > 0 && command && command.trim()) {
    //       const imageNote = `\n\n[Images provided at the following paths:]\n${tempImagePaths.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
    //       modifiedCommand = command + imageNote;
    //     }
    //   } catch (error) {
    //     console.error('Error processing images for Claude:', error);
    //   }
    // }

    // Create abort controller for cancellation
    const controller = new AbortController();
    const processKey = capturedSessionId || Date.now().toString();
    activeClaudeControllers.set(processKey, controller);

    let done: (() => void) | undefined;
    let receivedResult = new Promise<void>((resolve) => {
      done = resolve;
    });

    // Build options for the Anthropic SDK
    const queryOptions: Options = {
      cwd: workingDir,
      abortController: controller,
      // Debug handler to see tool call format and deny all
      canUseTool: async (
        toolName: string,
        input: Record<string, unknown>,
        { suggestions }: { signal: AbortSignal; suggestions?: PermissionUpdate[] },
      ): Promise<PermissionResult> => {
        console.log('\n========== TOOL PERMISSION REQUEST ==========');
        console.log('Tool Name:', toolName);
        console.log('Full Input:', JSON.stringify(input, null, 2));
        console.log('===========================================\n');
        console.log(JSON.stringify(suggestions, null, 2));

        if (isApprovableTool(toolName)) {
          if (!capturedSessionId) {
            return {
              behavior: 'deny',
              message: 'Cannot approve permission without a session ID',
            };
          }
          const requestId = uuidv4();
          const compositeKey = `${resume}:${requestId}`;
          const payload = {
            toolName,
            input,
            requestId,
          };

          console.log('sending permission request:', { sessionId: resume, requestId });
          sendMessage(output, {
            type: 'permission-request',
            permissionPayload: payload,
            sessionId: resume,
          });

          return new Promise<PermissionResult>((resolve) => {
            const timeout = setTimeout(() => {
              console.log('Permission request timed out');
              pendingPermissionRequests.delete(compositeKey);
              resolve({
                behavior: 'deny',
                message: 'Permission request timed out',
              });
            }, 100000);

            // Register in global map
            pendingPermissionRequests.set(compositeKey, {
              requestId,
              sessionId: resume || '',
              resolve,
              timeout,
            });
          });
        } else {
          const result = {
            behavior: 'allow' as const,
            updatedInput: input,
          };
          console.log('Returning permission result:', result);
          return result;
        }
      },
    };

    queryOptions.resume = resume;
    queryOptions.model = model || 'claude-opus-4-20250514';
    queryOptions.permissionMode = permissionMode;

    console.log('\n--- QUERY OPTIONS TO ANTHROPIC SDK ---');
    console.log('Prompt (first 200 chars):', (command || '').substring(0, 200));
    console.log('Query Options:', JSON.stringify(queryOptions, null, 2));

    async function* generateMessages() {
      // Always yield a message when we have content
      if (command) {
        const userMessage: SDKUserMessage = {
          type: 'user',
          session_id: capturedSessionId || '',
          message: {
            role: 'user',
            content: command,
          },
          parent_tool_use_id: null,
        };

        yield userMessage;
        await receivedResult;
      }
    }

    const stream = query({
      prompt: generateMessages(),
      options: queryOptions,
    });

    // Process messages from the async iterator
    for await (const message of stream) {
      console.log('Message Type:', message.type);
      if ('subtype' in message) {
        console.log('Message Subtype:', message.subtype);
      }

      // Convert message format to match old SDK expectations
      let convertedMessage: Record<string, unknown> | null = null;

      if (message.type === 'assistant' && message.message) {
        // Convert assistant messages to old format
        convertedMessage = {
          type: 'assistant',
          content: message.message.content,
          session_id: message.session_id,
        };
        console.log('Converted Assistant Message:', JSON.stringify(convertedMessage, null, 2));
      } else if (message.type === 'user' && message.message) {
        // Convert user messages (tool results) to old format
        const userContent = message.message.content;
        if (Array.isArray(userContent) && userContent.length > 0) {
          const firstContent = userContent[0];

          // Check if it's a tool result
          if (firstContent.type === 'tool_result') {
            convertedMessage = {
              type: 'tool_result',
              content: userContent,
            };
          } else {
            // Regular user message with text
            convertedMessage = {
              type: 'tool_result',
              content: userContent,
            };
          }
        }
        console.log(
          'Converted User/Tool Result Message:',
          JSON.stringify(convertedMessage, null, 2),
        );
      } else if (message.type === 'result') {
        // Don't send result messages to the UI - the old SDK doesn't do this
        // Result messages are handled separately below for completion
        if (done) {
          done();
        }

        console.log('Result message received - will trigger completion');
      } else if (message.type === 'system') {
        // System messages can pass through mostly unchanged but we'll skip sending them for now
        // as the old SDK doesn't seem to send these
        console.log('Skipping system message for UI compatibility');
      }

      // Send the converted message if we have one
      if (convertedMessage) {
        sendMessage(output, {
          type: 'claude-response',
          data: convertedMessage,
        });

        // Also send the content array separately for assistant messages (like old SDK does)
        if (convertedMessage.type === 'assistant' && convertedMessage.content) {
          sendMessage(output, {
            type: 'claude-response',
            data: convertedMessage.content,
          });
        }
      }

      // Handle session ID from system messages
      if (message.type === 'system' && message.subtype === 'init') {
        // console.log('--- SYSTEM INIT MESSAGE ---');
        // console.log('Session ID:', message.session_id);
        // console.log('API Key Source:', message.apiKeySource);
        // console.log('Model:', message.model);
        // console.log('Permission Mode:', message.permissionMode);
        // console.log('Tools:', message.tools);
        // console.log('MCP Servers:', message.mcp_servers);

        const sdkSessionId = message.session_id;

        if (sdkSessionId && sdkSessionId !== capturedSessionId) {
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
        } else if (sdkSessionId) {
          // Session ID matches what we requested - successful resume
          capturedSessionId = sdkSessionId;
        }
      }

      // Handle result messages (completion)
      if (message.type === 'result') {
        if ('usage' in message) {
          console.log('Usage:', message.usage);
        }

        if ('permission_denials' in message) {
          console.log('Permission Denials:', message.permission_denials);
        }

        if ('result' in message && message.subtype === 'success') {
          const resultMessage = message as { result?: string };
          console.log('Result Text (first 200 chars):', resultMessage.result?.substring(0, 200));
        }

        // Clean up controller reference
        const finalSessionId = capturedSessionId || processKey;
        activeClaudeControllers.delete(finalSessionId);

        // Determine exit code based on result subtype
        const exitCode = message.subtype === 'success' ? 0 : 1;

        // Send completion message
        sendMessage(output, {
          type: 'claude-complete',
          exitCode,
          isNewSession: !capturedSessionId && !!command, // Flag to indicate this was a new session
          sessionId: capturedSessionId, // Include the session ID in completion
        });
      }
    }

    console.log('\n--- MESSAGE ITERATION COMPLETE ---');
    console.log('Final captured session ID:', capturedSessionId);

    // Clean up temporary image files if any
    // if (tempImagePaths.length > 0) {
    //   for (const imagePath of tempImagePaths) {
    //     await fs
    //       .unlink(imagePath)
    //       .catch((err) => console.error(`Failed to delete temp image ${imagePath}:`, err));
    //   }
    //   if (tempDir) {
    //     await fs
    //       .rm(tempDir, { recursive: true, force: true })
    //       .catch((err) => console.error(`Failed to delete temp directory ${tempDir}:`, err));
    //   }
    // }

    console.log('========== SPAWN CLAUDE NEW COMPLETE ==========\n');

    // Return the final session ID
    return capturedSessionId;
  } catch (error) {
    console.log('\n!!! ERROR IN SPAWN CLAUDE NEW !!!');
    console.log('Error Type:', error?.constructor?.name);
    console.log('Error Message:', (error as Error).message);
    console.log('Error Stack:', (error as Error).stack);
    console.log('Full Error Object:', error);
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
      isNewSession: !capturedSessionId && !!command,
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

export { spawnClaude, abortClaudeSession, createStreamWrapper };
