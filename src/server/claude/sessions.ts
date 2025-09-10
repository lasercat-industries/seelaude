/**
 * Tree-based deduplication for Claude Code session files with fork support.
 *
 * Unlike the linear chain approach, this handles cases where conversations
 * can fork into multiple branches from any point.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';
import { createReadStream, statSync } from 'fs';
import * as os from 'os';
import type {
  SimpleSessionMessage,
  SessionData,
  SessionNode,
  BranchEndpoint,
  ForkPoint,
  BranchInfo,
  SessionTreesResult,
  LatestSession,
  ContentItem,
  SessionMessage,
} from '@shared/claude/types';

import { isContentItemArray } from '@shared/claude/types';

/**
 * Extract all message UUIDs and content from a session file
 */
export async function extractSessionData(filepath: string): Promise<SessionData> {
  const messages: SimpleSessionMessage[] = [];
  const uuids = new Set<string>();
  let sessionId: string | null = null;
  let firstUserMessageUuid: string | null = null;

  try {
    const fileStream = createReadStream(filepath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      try {
        const data = JSON.parse(line);

        // Capture session ID
        if (data.sessionId && !sessionId) {
          sessionId = data.sessionId;
        }

        // Capture UUIDs
        if (data.uuid) {
          uuids.add(data.uuid);
        }

        // Capture parent UUID to establish relationships
        if (data.parentUuid) {
          // Store parent-child relationship info
          if (
            !firstUserMessageUuid &&
            data.type === 'user' &&
            !data.parentUuid.includes('00000000')
          ) {
            firstUserMessageUuid = data.parentUuid;
          }
        }

        // Extract message content
        if (data.message && data.message.content) {
          const content = data.message.content;
          if (isContentItemArray(content)) {
            content.forEach((item: ContentItem) => {
              if (item.text) {
                messages.push({
                  text: item.text,
                  uuid: data.uuid,
                  parentUuid: data.parentUuid,
                  type: data.type,
                });
              }
            });
          } else if (typeof content === 'string') {
            messages.push({
              text: content,
              uuid: data.uuid,
              parentUuid: data.parentUuid,
              type: data.type,
            });
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error reading ${filepath}: ${error.message}`);
    } else {
      console.error(`Error reading ${filepath}:`, error);
    }
  }

  return {
    sessionId,
    messages,
    uuids,
    firstUserMessageUuid,
    filepath,
  };
}

/**
 * Determine parent-child relationships between sessions
 */
export function findSessionRelationships(sessionsData: SessionData[]): {
  relationships: Map<string, string>;
  children: Map<string, Set<string>>;
} {
  const relationships = new Map<string, string>(); // child -> parent
  const children = new Map<string, Set<string>>(); // parent -> Set of children

  for (let i = 0; i < sessionsData.length; i++) {
    const potentialChild = sessionsData[i];
    if (!potentialChild) continue;

    let bestParent: SessionData | null = null;
    let maxSharedMessages = 0;

    for (let j = 0; j < sessionsData.length; j++) {
      if (i === j) continue;

      const potentialParent = sessionsData[j];
      if (!potentialParent) continue;

      // Check if potentialParent's messages are a prefix of potentialChild's messages
      if (potentialParent.messages.length < potentialChild.messages.length) {
        let isPrefix = true;
        let sharedCount = 0;

        for (let k = 0; k < potentialParent.messages.length; k++) {
          const parentMsg = potentialParent.messages[k];
          const childMsg = potentialChild.messages[k];
          if (!parentMsg || !childMsg || parentMsg.text !== childMsg.text) {
            isPrefix = false;
            break;
          }
          sharedCount++;
        }

        // If this is a valid parent and has more shared messages than previous best
        if (isPrefix && sharedCount > maxSharedMessages) {
          bestParent = potentialParent;
          maxSharedMessages = sharedCount;
        }
      }
    }

    if (bestParent) {
      relationships.set(potentialChild.filepath, bestParent.filepath);

      if (!children.has(bestParent.filepath)) {
        children.set(bestParent.filepath, new Set<string>());
      }
      children.get(bestParent.filepath)!.add(potentialChild.filepath);
    }
  }

  return { relationships, children };
}

/**
 * Build a tree structure from the relationships
 */
export function buildSessionTree(
  sessionsData: SessionData[],
  relationships: Map<string, string>,
  children: Map<string, Set<string>>,
): SessionNode[] {
  const sessionMap = new Map(sessionsData.map((s) => [s.filepath, s]));
  const trees: SessionNode[] = [];
  const processed = new Set<string>();

  // Find root nodes (sessions with no parent)
  const roots = sessionsData.filter((s) => !relationships.has(s.filepath));

  function buildNode(filepath: string): SessionNode | null {
    if (processed.has(filepath)) return null;
    processed.add(filepath);

    const sessionData = sessionMap.get(filepath);
    if (!sessionData) return null;

    const stats = statSync(filepath);

    const node: SessionNode = {
      sessionId: sessionData.sessionId || path.basename(filepath).replace('.jsonl', ''),
      filename: path.basename(filepath),
      path: filepath,
      messageCount: sessionData.messages.length,
      firstMessage: sessionData.messages[0]?.text || null,
      lastMessage: sessionData.messages[sessionData.messages.length - 1]?.text || null,
      size: stats.size,
      modified: stats.mtime.toISOString(),
      created: stats.birthtime.toISOString(),
      branches: [],
    };

    // Add children as branches
    if (children.has(filepath)) {
      for (const childPath of children.get(filepath)!) {
        const childNode = buildNode(childPath);
        if (childNode) {
          node.branches.push(childNode);
        }
      }
    }

    // Sort branches by modification time (newest first)
    node.branches.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

    return node;
  }

  // Build tree for each root
  for (const root of roots) {
    const tree = buildNode(root.filepath);
    if (tree) {
      trees.push(tree);
    }
  }

  return trees;
}

/**
 * Find all leaf nodes (endpoints) and fork points
 */
function findBranchInfo(node: SessionNode): BranchInfo {
  const branches: BranchEndpoint[] = [];
  const forkPoints: ForkPoint[] = [];

  function traverse(n: SessionNode, path: string[] = []): void {
    const currentPath = [...path, n.filename];

    if (n.branches.length === 0) {
      // Leaf node - this is a branch endpoint
      branches.push({
        endpoint: n.filename,
        sessionId: n.sessionId,
        messageCount: n.messageCount,
        lastMessage: n.lastMessage,
        path: currentPath,
      });
    } else if (n.branches.length > 1) {
      // Fork point
      forkPoints.push({
        forkAt: n.filename,
        sessionId: n.sessionId,
        branchCount: n.branches.length,
        branches: n.branches.map((b) => b.filename),
      });
    }

    for (const branch of n.branches) {
      traverse(branch, currentPath);
    }
  }

  traverse(node);
  return { branches, forkPoints };
}

/**
 * Find the latest user message across all branches
 */
function findLatestUserMessage(node: SessionNode, sessionsData: SessionData[]): string | null {
  let latestUserMessage: string | null = null;
  let latestTime = new Date(0);

  // Helper to get session data by filename
  const getSessionData = (filename: string): SessionData | undefined => {
    return sessionsData.find((s) => path.basename(s.filepath) === filename);
  };

  function traverse(n: SessionNode): void {
    const nodeTime = new Date(n.modified);
    const sessionData = getSessionData(n.filename);

    if (sessionData) {
      // Find last user message in this session
      for (let i = sessionData.messages.length - 1; i >= 0; i--) {
        const message = sessionData.messages[i];
        if (message && message.type === 'user') {
          if (nodeTime > latestTime) {
            latestTime = nodeTime;
            latestUserMessage = message.text;
          }
          break;
        }
      }
    }

    for (const branch of n.branches) {
      traverse(branch);
    }
  }

  traverse(node);
  return latestUserMessage;
}

/**
 * Count total branches in a tree
 */
function countBranches(node: SessionNode): number {
  let count = node.branches.length > 1 ? 1 : 0; // Count as fork point if multiple branches

  for (const branch of node.branches) {
    count += countBranches(branch);
  }

  return count;
}

/**
 * Calculate maximum depth of tree
 */
function calculateDepth(node: SessionNode): number {
  if (node.branches.length === 0) return 1;

  return 1 + Math.max(...node.branches.map(calculateDepth));
}

/**
 * Get session trees with full metadata
 */
export async function getSessionTreesJSON(
  directory: string = process.cwd(),
): Promise<SessionTreesResult> {
  // Get all .jsonl files
  const dirEntries = await fs.readdir(directory);
  const jsonlFiles = dirEntries
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => path.join(directory, f));

  // Extract data from all sessions
  const sessionsData = await Promise.all(
    jsonlFiles.map((filepath) => extractSessionData(filepath)),
  );

  // Find relationships
  const { relationships, children } = findSessionRelationships(sessionsData);

  // Build trees
  const trees = buildSessionTree(sessionsData, relationships, children);

  // Calculate statistics
  const result: SessionTreesResult = {
    totalTrees: trees.length,
    totalSessions: jsonlFiles.length,
    trees: trees.map((tree) => {
      const branchInfo = findBranchInfo(tree);
      return {
        rootId: tree.sessionId,
        root: tree.filename,
        firstMessage: tree.firstMessage,
        latestUserMessage: findLatestUserMessage(tree, sessionsData),
        totalBranches: countBranches(tree),
        maxDepth: calculateDepth(tree),
        branches: branchInfo.branches,
        forkPoints: branchInfo.forkPoints,
        structure: tree,
      };
    }),
  };

  return result;
}

/**
 * Get only the latest sessions (all leaf nodes from all trees)
 * Returns an array of latest sessions, handling forks by including all branch endpoints
 */
export async function getLatestSessions(
  directory: string = process.cwd(),
): Promise<LatestSession[]> {
  const treesResult = await getSessionTreesJSON(directory);
  const latestSessions: LatestSession[] = [];

  for (const tree of treesResult.trees) {
    // If no forks, just get the single latest session
    if (tree.branches.length === 1) {
      const endpoint = tree.branches[0];
      if (endpoint) {
        latestSessions.push({
          rootId: tree.rootId,
          sessionId: endpoint.sessionId,
          filename: endpoint.endpoint,
          messageCount: endpoint.messageCount,
          lastMessage: endpoint.lastMessage,
          isFork: false,
          forkFrom: null,
          path: endpoint.path,
        });
      }
    } else {
      // Multiple branches - include all endpoints
      for (const branch of tree.branches) {
        // Find the fork point for this branch
        let forkFrom: string | null = null;
        if (tree.forkPoints.length > 0) {
          // Find which fork point this branch descended from
          for (const fork of tree.forkPoints) {
            if (branch.path.includes(fork.forkAt)) {
              forkFrom = fork.sessionId || fork.forkAt.replace('.jsonl', '');
              break;
            }
          }
        }

        latestSessions.push({
          rootId: tree.rootId,
          sessionId: branch.sessionId,
          filename: branch.endpoint,
          messageCount: branch.messageCount,
          lastMessage: branch.lastMessage,
          isFork: true,
          forkFrom: forkFrom,
          path: branch.path,
        });
      }
    }
  }

  return latestSessions;
}

/**
 * Get all messages for a specific session
 * @param projectName - The encoded project name (e.g., "-Users-username-repos-project")
 * @param sessionId - The UUID of the session to load messages for
 * @param baseDir - Optional base directory (defaults to ~/.claude/projects)
 * @returns Array of session messages sorted by timestamp
 */
export async function getSessionMessages(
  projectName: string,
  sessionId: string,
  baseDir?: string,
): Promise<SessionMessage[]> {
  const projectDir = baseDir
    ? path.join(baseDir, projectName)
    : path.join(os.homedir(), '.claude', 'projects', projectName);
  const messages: SessionMessage[] = [];

  try {
    const files = await fs.readdir(projectDir);
    const jsonlFiles = files.filter((file) => file.endsWith('.jsonl'));

    for (const file of jsonlFiles) {
      const jsonlFile = path.join(projectDir, file);
      const fileStream = createReadStream(jsonlFile);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        if (line.trim()) {
          try {
            const entry = JSON.parse(line);
            if (entry.sessionId === sessionId) {
              messages.push(entry);
            }
          } catch {
            // Skip invalid lines
          }
        }
      }

      rl.close();
      fileStream.destroy();
    }

    // Sort messages by timestamp
    messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch (error) {
    console.error(`Error reading messages for session ${sessionId}:`, error);
  }

  return messages;
}

/**
 * Get the latest descendant session ID for a given session in a project.
 * If the session has no descendants, returns the input session ID.
 *
 * @param projectName - The encoded project name (e.g., "-Users-username-repos-project")
 * @param sessionId - The UUID of the session to find descendants for
 * @param baseDir - Optional base directory (defaults to ~/.claude/projects)
 * @returns The session ID of the most recently updated descendant (or the input sessionId if no descendants)
 */
export async function getLatestDescendant(
  projectName: string,
  sessionId: string,
  baseDir?: string,
): Promise<string> {
  const projectDir = baseDir
    ? path.join(baseDir, projectName)
    : path.join(os.homedir(), '.claude', 'projects', projectName);

  // Get the session tree for this project
  const treesResult = await getSessionTreesJSON(projectDir);

  // Find all descendants of the given session ID
  const descendants: { sessionId: string; lastModified: Date }[] = [];

  // Helper function to recursively find descendants
  function findDescendants(node: SessionNode, isDescendant: boolean = false) {
    // If this node matches our session ID, mark all children as descendants
    if (node.sessionId === sessionId) {
      isDescendant = false; // Don't include the node itself
      // Process its branches as descendants
      for (const child of node.branches) {
        findDescendants(child, true);
      }
    } else if (isDescendant) {
      // This is a descendant - add it to our list
      descendants.push({
        sessionId: node.sessionId,
        lastModified: new Date(node.modified),
      });
      // Continue checking its branches
      for (const child of node.branches) {
        findDescendants(child, true);
      }
    } else {
      // Keep searching for the target session
      for (const child of node.branches) {
        findDescendants(child, false);
      }
    }
  }

  // Search through all trees
  for (const tree of treesResult.trees) {
    findDescendants(tree.structure);
  }

  // If no descendants found, return the original session ID
  if (descendants.length === 0) {
    return sessionId;
  }

  // Find the most recently modified descendant
  const latestDescendant = descendants.reduce((latest, current) => {
    return current.lastModified > latest.lastModified ? current : latest;
  });

  return latestDescendant.sessionId;
}
