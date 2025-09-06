import type { ToolName, PermissionMode } from '@instantlyeasy/claude-code-sdk-ts';
/**
 * Shared type definitions for Claude API data structures
 * These types are used across multiple modules that parse Claude's JSONL files
 */

/**
 * Content item with text property
 */
export interface TextContentItem {
  text: string;
  type?: string;
  [key: string]: unknown;
}

/**
 * Content item with legacy content property (used in some older formats)
 */
export interface LegacyContentItem {
  content: string;
  type?: string;
  [key: string]: unknown;
}

/**
 * Generic content item that can appear in message.content arrays
 */
export interface ContentItem {
  text?: string;
  type?: string;
  [key: string]: unknown; // Allow other properties but be more specific than 'any'
}

/**
 * Specific content item types that we know about
 */
export type SpecificContentItem = TextContentItem | LegacyContentItem | ContentItem;

/**
 * Message content can be either a string or an array of content items
 */
export type MessageContent = string | SpecificContentItem[];

/**
 * Core structure of a JSONL entry from Claude session files
 */
export interface ClaudeJSONLEntry {
  sessionId?: string;
  uuid?: string;
  parentUuid?: string;
  timestamp?: string;
  type?: 'user' | 'assistant' | 'system';
  cwd?: string; // Current working directory
  message?: {
    role: string;
    content: MessageContent;
  };
}

/**
 * Session representation focused on metadata and activity
 */
export interface ClaudeSession {
  id: string;
  summary?: string;
  title?: string;
  lastActivity: string;
  messageCount: number;
  created: string;
  projectName?: string;
  __provider?: string; // Added for provider tracking
}

/**
 * Project representation with sessions
 */
export interface ClaudeProject {
  name: string; // Encoded project name (e.g., "-Users-rylandgoldstein-repos-chess-helper")
  path: string; // Actual filesystem path (e.g., "/Users/rylandgoldstein/repos/chess-helper")
  displayName: string; // Human-readable name (e.g., "chess-helper")
  fullPath: string; // Same as path, kept for compatibility
  sessions: ClaudeSession[];
  sessionMeta?: {
    hasMore: boolean;
    total: number;
    offset?: number;
    limit?: number;
  };
}

/**
 * Session message with full details
 */
export interface SessionMessage {
  sessionId: string;
  type: 'user' | 'assistant' | 'system';
  message?: {
    role: string;
    content: MessageContent;
    id?: string; // Optional id property for messages
  };
  timestamp: string;
  uuid?: string;
}

/**
 * Simplified message for tree analysis
 */
export interface Message {
  text: string;
  uuid: string;
  parentUuid: string;
  type: string;
}

/**
 * Session data for relationship analysis
 */
export interface SessionData {
  sessionId: string | null;
  messages: Message[];
  uuids: Set<string>;
  firstUserMessageUuid: string | null;
  filepath: string;
}

/**
 * Session node in tree structure
 */
export interface SessionNode {
  sessionId: string;
  filename: string;
  path: string;
  messageCount: number;
  firstMessage: string | null;
  lastMessage: string | null;
  size: number;
  modified: string;
  created: string;
  branches: SessionNode[];
}

/**
 * Branch endpoint information
 */
export interface BranchEndpoint {
  endpoint: string;
  sessionId: string;
  messageCount: number;
  lastMessage: string | null;
  path: string[];
}

/**
 * Fork point in session tree
 */
export interface ForkPoint {
  forkAt: string;
  sessionId: string;
  branchCount: number;
  branches: string[];
}

/**
 * Branch information
 */
export interface BranchInfo {
  branches: BranchEndpoint[];
  forkPoints: ForkPoint[];
}

/**
 * Complete session tree structure
 */
export interface SessionTree {
  rootId: string;
  root: string;
  firstMessage: string | null;
  latestUserMessage: string | null;
  totalBranches: number;
  maxDepth: number;
  branches: BranchEndpoint[];
  forkPoints: ForkPoint[];
  structure: SessionNode;
}

/**
 * Session trees result
 */
export interface SessionTreesResult {
  totalTrees: number;
  totalSessions: number;
  trees: SessionTree[];
}

/**
 * Latest session information
 */
export interface LatestSession {
  rootId: string;
  sessionId: string;
  filename: string;
  messageCount: number;
  lastMessage: string | null;
  isFork: boolean;
  forkFrom: string | null;
  path: string[];
}

/**
 * Type guard to check if content is a ContentItem array
 */
export function isContentItemArray(content: MessageContent): content is SpecificContentItem[] {
  return Array.isArray(content);
}

/**
 * Type guard for TextContentItem
 */
export function isTextContentItem(item: unknown): item is TextContentItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'text' in item &&
    typeof (item as TextContentItem).text === 'string'
  );
}

/**
 * Type guard for LegacyContentItem
 */
export function isLegacyContentItem(item: unknown): item is LegacyContentItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'content' in item &&
    typeof (item as LegacyContentItem).content === 'string'
  );
}

/**
 * Helper to extract text from a content item
 */
export function extractTextFromContentItem(item: unknown): string {
  if (isTextContentItem(item)) {
    return item.text;
  }
  if (isLegacyContentItem(item)) {
    return item.content;
  }
  return '[Complex content]';
}

/**
 * Type guard to check if an error has a code property
 */
export function isNodeError(error: unknown): error is Error & { code?: string } {
  return error instanceof Error && 'code' in error;
}
export interface ToolsSettings {
  allowedTools?: ToolName[];
  disallowedTools?: ToolName[];
  skipPermissions?: boolean;
}

export interface ImageData {
  data: string; // base64 encoded image with data URL format (e.g., "data:image/png;base64,...")
}

export interface SpawnClaudeOptions {
  sessionId?: string;
  projectPath?: string; // Not used in refactored version but kept for API compatibility
  cwd?: string;
  resume?: boolean;
  toolsSettings?: ToolsSettings;
  permissionMode?: PermissionMode; // 'default' | 'acceptEdits' | 'bypassPermissions'
  images?: ImageData[];
}

export type ClaudeCommandMessage = {
  type: 'claude-command';
  command: string;
  options: SpawnClaudeOptions;
};
