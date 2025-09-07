/**
 * Type definitions for ChatInterfaceNew component
 */

import type { ClaudeProject, ClaudeSession, SessionMessage } from '@shared/claude/types';
import type { WebSocketMessage, OutgoingMessage, WebSocket } from '@shared/types';

export interface DiffInfo {
  old_string: string;
  new_string: string;
}

/**
 * Main component props interface
 */
export interface ChatInterfaceProps {
  selectedProject?: ClaudeProject;
  selectedSession?: ClaudeSession;
  sendMessage: (message: OutgoingMessage) => void;
  messages: WebSocketMessage[];
  onFileOpen: (path: string, diffInfo: DiffInfo | null) => void;
  onInputFocusChange: (focused: boolean) => void;
  onSessionActive: (sessionId: string) => void;
  onSessionInactive: () => void;
  onReplaceTemporarySession: (newSessionId: string) => void;
  onShowSettings: () => void;
  autoExpandTools: boolean;
  showRawParameters: boolean;
  autoScrollToBottom: boolean;
  sendByCtrlEnter: boolean;
  onShowAllTasks: () => void;
  ws?: WebSocket | null;
}

export interface ExtendedMessage extends Omit<SessionMessage, 'type'> {
  isToolUse?: boolean;
  toolName?: string;
  toolId?: string;
  toolInput?: string;
  toolResult?: {
    content: string;
    isError: boolean;
  };
  reasoning?: string;
  images?: Array<{ data: string; name: string }>;
}

/**
 * Chat message type extending ExtendedMessage
 */
export type ChatMessage = ExtendedMessage & {
  type: 'user' | 'assistant' | 'system' | 'tool' | 'tool_result' | 'hook_feedback' | 'error';
  id?: string;
  isStreaming?: boolean;
  files?: AttachedFile[];
  isInteractivePrompt?: boolean;
  isClaude?: boolean;
  images?: string[];
  content: string;
  isError?: boolean;
};

/**
 * Uploaded image structure
 */
export interface UploadedImage {
  id: string;
  url: string;
  file: File;
  status: 'uploading' | 'uploaded' | 'error';
  progress?: number;
  error?: string;
}

/**
 * Attached file structure
 */
export interface AttachedFile {
  path: string;
  name: string;
  content?: string;
}

/**
 * File tree node for file explorer
 */
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

/**
 * Claude status information
 */
export interface ClaudeStatus {
  text: string;
  tokens: number;
  can_interrupt: boolean;
}

/**
 * API response types
 */
export interface SessionMessagesResponse {
  messages: SessionMessage[];
  hasMore?: boolean;
  total?: number;
}

export interface ProjectFilesResponse {
  files: FileTreeNode[];
}

/**
 * Pagination state
 */
export interface PaginationState {
  offset: number;
  limit: number;
  hasMore: boolean;
  total: number;
}

/**
 * Diff display options
 */
export interface DiffOptions {
  showAdditions: boolean;
  showDeletions: boolean;
  context: number;
}

/**
 * Permission modes
 */
export type PermissionMode = 'default' | 'auto' | 'always-ask';

/**
 * Provider types
 */
export type Provider = 'claude' | 'cursor';

/**
 * Message type union
 */
export type MessageType = 'user' | 'assistant' | 'system' | 'error';

/**
 * Extended window interface for global functions
 */
declare global {
  interface Window {
    refreshProjects?: () => void;
  }
}

/**
 * Helper function types
 */
export type FormatUsageLimitText = (text: string) => string;
export type ParseAnsiToHtml = (text: string) => string;
export type CreateDiff = (oldStr: string, newStr: string) => string;
export type LoadSessionMessages = (
  projectName: string,
  sessionId: string,
  loadMore?: boolean,
) => Promise<SessionMessage[]>;
export type ConvertSessionMessages = (rawMessages: SessionMessage[]) => ChatMessage[];
export type FlattenFileTree = (files: FileTreeNode[], prefix?: string) => FileTreeNode[];

/**
 * Scroll position state
 */
export interface ScrollPosition {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/**
 * Upload state for images
 */
export interface ImageUploadState {
  uploading: boolean;
  progress: number;
  error?: string;
}

/**
 * Textarea resize state
 */
export interface TextareaState {
  height: string;
  overflow: string;
}

/**
 * Stream buffer state for message streaming
 */
export interface StreamState {
  buffer: string;
  timer: typeof setTimeout | null;
  isStreaming: boolean;
}