/**
 * Standalone utility for loading Claude projects and sessions from the filesystem
 * This reads from the ~/.claude/projects directory structure
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import type { ClaudeSession, ClaudeProject, SessionMessage, ContentItem } from '@shared/claude/types';

import { isContentItemArray, isNodeError } from '@shared/claude/types';

/**
 * Extract the actual project directory path from encoded project name
 * by reading the first JSONL entry that contains the cwd field
 */
async function extractProjectDirectory(projectName: string, baseDir?: string): Promise<string> {
  const projectDir = baseDir
    ? path.join(baseDir, projectName)
    : path.join(os.homedir(), '.claude', 'projects', projectName);

  try {
    const files = await fs.readdir(projectDir);
    const jsonlFiles = files.filter((file) => file.endsWith('.jsonl')).sort();

    if (jsonlFiles.length === 0) {
      // No JSONL files, try to decode from project name
      return decodeProjectPath(projectName);
    }

    // Read first few lines of JSONL files to find cwd
    for (const jsonlFile of jsonlFiles.slice(0, 3)) {
      // Check first 3 files
      const filePath = path.join(projectDir, jsonlFile);
      const fileStream = fsSync.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      let lineCount = 0;
      for await (const line of rl) {
        if (line.trim() && lineCount < 10) {
          // Check first 10 lines
          lineCount++;
          try {
            const entry = JSON.parse(line);
            if (entry.cwd) {
              rl.close();
              fileStream.destroy();
              return entry.cwd;
            }
          } catch {
            // Invalid JSON line, skip
          }
        }
      }

      rl.close();
      fileStream.destroy();
    }
  } catch (error) {
    console.warn(`Could not extract project directory for ${projectName}:`, error);
  }

  // Fallback: decode from project name
  return decodeProjectPath(projectName);
}

/**
 * Decode project path from encoded name
 * Example: "-Users-rylandgoldstein-repos-chess-helper" -> "/Users/rylandgoldstein/repos/chess-helper"
 */
function decodeProjectPath(encodedName: string): string {
  // Handle double-encoded paths (contains --)
  const parts = encodedName.split('--');
  const lastPart = parts[parts.length - 1];

  if (!lastPart) return '';

  // If it starts with Users- or home-, add leading slash
  if (lastPart.startsWith('Users-') || lastPart.startsWith('home-')) {
    return '/' + lastPart.replace(/-/g, '/');
  }

  // Otherwise just replace dashes with slashes
  return lastPart.replace(/-/g, '/');
}

/**
 * Generate a display name from the project path
 */
function generateDisplayName(projectName: string, actualPath?: string): string {
  if (actualPath) {
    // Use the last part of the actual path
    const parts = actualPath.split('/');
    return parts[parts.length - 1] || projectName;
  }

  // Fallback to decoding from project name
  const decoded = decodeProjectPath(projectName);
  const parts = decoded.split('/');
  return parts[parts.length - 1] || projectName;
}

/**
 * Parse JSONL file and extract sessions
 */
async function parseJsonlSessions(filePath: string): Promise<Map<string, ClaudeSession>> {
  const sessions = new Map<string, ClaudeSession>();

  try {
    const fileStream = fsSync.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (line.trim()) {
        try {
          const entry = JSON.parse(line) as SessionMessage;

          if (entry.sessionId) {
            if (!sessions.has(entry.sessionId)) {
              // Create new session entry
              sessions.set(entry.sessionId, {
                id: entry.sessionId,
                summary: undefined,
                lastActivity: entry.timestamp,
                messageCount: 1,
                created: entry.timestamp,
              });
            } else {
              // Update existing session
              const session = sessions.get(entry.sessionId)!;
              session.messageCount++;
              session.lastActivity = entry.timestamp;

              // Try to extract summary from first user message
              if (!session.summary && entry.type === 'user' && entry.message?.content) {
                let contentText = '';
                if (typeof entry.message.content === 'string') {
                  contentText = entry.message.content;
                } else if (isContentItemArray(entry.message.content)) {
                  const firstItem = entry.message.content[0] as ContentItem;
                  contentText = firstItem?.text || '';
                }
                session.summary =
                  contentText.substring(0, 100) + (contentText.length > 100 ? '...' : '');
              }
            }
          }
        } catch {
          // Invalid JSON line, skip
        }
      }
    }

    rl.close();
    fileStream.destroy();
  } catch (error) {
    console.error(`Error parsing JSONL file ${filePath}:`, error);
  }

  return sessions;
}

/**
 * Get sessions for a specific project
 */
export async function getSessions(
  projectName: string,
  limit: number = 5,
  offset: number = 0,
  baseDir?: string,
): Promise<{
  sessions: ClaudeSession[];
  hasMore: boolean;
  total: number;
  offset: number;
  limit: number;
}> {
  const projectDir = baseDir
    ? path.join(baseDir, projectName)
    : path.join(os.homedir(), '.claude', 'projects', projectName);

  try {
    const files = await fs.readdir(projectDir);
    const jsonlFiles = files.filter((file) => file.endsWith('.jsonl'));

    if (jsonlFiles.length === 0) {
      return { sessions: [], hasMore: false, total: 0, offset, limit };
    }

    // Get file stats to sort by modification time
    const filesWithStats = await Promise.all(
      jsonlFiles.map(async (file) => {
        const filePath = path.join(projectDir, file);
        const stats = await fs.stat(filePath);
        return { file, mtime: stats.mtime };
      }),
    );

    // Sort files by modification time (newest first)
    filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    const allSessions = new Map<string, ClaudeSession>();
    let processedCount = 0;

    // Process files in order of modification time
    for (const { file } of filesWithStats) {
      const jsonlFile = path.join(projectDir, file);
      const sessions = await parseJsonlSessions(jsonlFile);

      // Merge sessions, avoiding duplicates by session ID
      sessions.forEach((session, id) => {
        if (!allSessions.has(id)) {
          allSessions.set(id, session);
        }
      });

      processedCount++;

      // Early exit optimization
      if (
        allSessions.size >= (limit + offset) * 2 &&
        processedCount >= Math.min(3, filesWithStats.length)
      ) {
        break;
      }
    }

    // Convert to array and sort by last activity
    const sortedSessions = Array.from(allSessions.values()).sort(
      (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime(),
    );

    const total = sortedSessions.length;
    const paginatedSessions = sortedSessions.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      sessions: paginatedSessions,
      hasMore,
      total,
      offset,
      limit,
    };
  } catch (error) {
    console.error(`Error reading sessions for project ${projectName}:`, error);
    return { sessions: [], hasMore: false, total: 0, offset, limit };
  }
}

/**
 * Get all Claude projects from the filesystem
 */
export async function getProjects(baseDir?: string): Promise<ClaudeProject[]> {
  const claudeDir = baseDir || path.join(os.homedir(), '.claude', 'projects');
  const projects: ClaudeProject[] = [];
  const existingProjects = new Set<string>();

  try {
    // Check if the .claude/projects directory exists
    await fs.access(claudeDir);

    // Get existing Claude projects from the file system
    const entries = await fs.readdir(claudeDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        existingProjects.add(entry.name);

        // Extract actual project directory from JSONL sessions
        const actualProjectDir = await extractProjectDirectory(entry.name, baseDir);

        // Generate display name from the project path
        const displayName = generateDisplayName(entry.name, actualProjectDir);

        const project: ClaudeProject = {
          name: entry.name,
          path: actualProjectDir,
          displayName: displayName,
          fullPath: actualProjectDir,
          sessions: [],
        };

        // Load sessions for this project (just first 5 for performance)
        try {
          const sessionResult = await getSessions(entry.name, 5, 0, baseDir);
          project.sessions = sessionResult.sessions;
          project.sessionMeta = {
            hasMore: sessionResult.hasMore,
            total: sessionResult.total,
            offset: sessionResult.offset,
            limit: sessionResult.limit,
          };
        } catch (e) {
          console.warn(`Could not load sessions for project ${entry.name}:`, e);
          project.sessions = [];
        }

        projects.push(project);
      }
    }
  } catch (error) {
    // If the directory doesn't exist (ENOENT), that's okay - return empty
    if (isNodeError(error) && error.code !== 'ENOENT') {
      console.error('Error reading projects directory:', error);
    }
  }

  return projects;
}

// Export convenience function to get all sessions for a project (no pagination)
export async function getAllSessionsForProject(
  projectName: string,
  baseDir?: string,
): Promise<ClaudeSession[]> {
  const result = await getSessions(projectName, 1000, 0, baseDir); // Get up to 1000 sessions
  return result.sessions;
}
