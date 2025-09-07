/**
 * Type definitions for Cursor-specific data structures
 */

import type { Message, CLIOutput } from '@lasercat/claude-code-sdk-ts';

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
 * Claude output data type alias
 */
export type ClaudeOutputData = CLIOutput;
