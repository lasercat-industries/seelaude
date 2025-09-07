/**
 * Type definitions for Cursor-specific data structures
 */

import type { Message, CLIOutput } from '@lasercat/claude-code-sdk-ts';

/**
 * Cursor message blob structure from SQLite
 */
export interface CursorMessageBlob {
  role: 'user' | 'assistant' | 'system';
  content?: string | Array<{ text?: string; type?: string }>;
  timestamp?: string;
}

/**
 * Cursor session API response
 */
export interface CursorSessionResponse {
  session?: {
    messages?: CursorMessageBlob[];
  };
}

/**
 * Content item in Cursor messages
 */
export interface CursorContentItem {
  text?: string;
  type?: string;
}

/**
 * Claude response data in WebSocket messages
 */
export interface ClaudeResponseData {
  message?: Message;
  type?: string;
  delta?: { text: string };
}

/**
 * Streaming message data types
 */
export interface StreamingMessageData {
  type: 'content_block_delta' | 'content_block_stop';
  delta?: { text: string };
}

/**
 * Tool result message content
 */
export interface ToolResultContent {
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
  type?: string;
  text?: string;
}

/**
 * Tool result message
 */
export interface ToolResultMessage {
  type: 'tool_result';
  content?: ToolResultContent[];
  role?: string;
  id?: string;
}

/**
 * User message with tool results
 */
export interface UserMessageWithToolResults {
  role: 'user';
  content: Array<{
    type: 'tool_result';
    tool_use_id: string;
    content: string;
    is_error?: boolean;
  }>;
}

/**
 * Cursor tool use data
 */
export interface CursorToolUseData {
  tool?: { name: string };
  input?: unknown;
}

/**
 * Cursor result data
 */
export interface CursorResultData {
  result?: string;
  is_error?: boolean;
}

/**
 * Claude status data
 */
export interface ClaudeStatusData {
  text?: string;
  thinking?: boolean;
  can_interrupt?: boolean;
  message?: string;
  status?: string;
  tokens?: number;
  token_count?: number;
}

/**
 * Type guard for CursorContentItem
 */
export function isCursorContentItem(item: unknown): item is CursorContentItem {
  return typeof item === 'object' && item !== null && ('text' in item || 'type' in item);
}

/**
 * Type guard for string or CursorContentItem
 */
export function isStringOrContentItem(item: unknown): item is string | CursorContentItem {
  return typeof item === 'string' || isCursorContentItem(item);
}

/**
 * Claude output data type alias
 */
export type ClaudeOutputData = CLIOutput;

/**
 * Cursor output data type (raw string)
 */
export type CursorOutputData = string;