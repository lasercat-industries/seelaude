/**
 * Type definitions for ChatInterfaceNew component
 */

import type { 
  ClaudeProject, 
  ClaudeSession, 
  SessionMessage 
} from '@shared/claude/types';
import type { 
  WebSocketMessage, 
  OutgoingMessage, 
  WebSocket 
} from '@shared/types';
import type { ExtendedMessage } from './MessageComponent';

/**
 * Main component props interface
 */
export interface ChatInterfaceProps {
  selectedProject?: ClaudeProject;
  selectedSession?: ClaudeSession;
  sendMessage: (message: OutgoingMessage) => void;
  messages: WebSocketMessage[];
  onFileOpen: (path: string) => void;
  onInputFocusChange: (focused: boolean) => void;
  onSessionActive: (sessionId: string) => void;
  onSessionInactive: () => void;
  onReplaceTemporarySession: (newSessionId: string) => void;
  onNavigateToSession: (sessionId: string) => void;
  onShowSettings: () => void;
  autoExpandTools: boolean;
  showRawParameters: boolean;
  autoScrollToBottom: boolean;
  sendByCtrlEnter: boolean;
  onShowAllTasks: () => void;
  onTaskClick?: (task: any) => void;
  ws?: WebSocket | null;
}

/**
 * Chat message type extending ExtendedMessage
 */
export type ChatMessage = ExtendedMessage & {
  isStreaming?: boolean;
  files?: AttachedFile[];
  isInteractivePrompt?: boolean;
  isClaude?: boolean;
  images?: string[];
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
 * Image attachment component props
 */
export interface ImageAttachmentProps {
  file: File;
  onRemove: () => void;
  uploadProgress?: number;
  error?: string;
}

/**
 * Message block component props
 */
export interface MessageBlockProps {
  message: ChatMessage;
  prevMessage?: ChatMessage;
  nextMessage?: ChatMessage;
  createDiff: (oldStr: string, newStr: string) => string;
  onFileOpen: (path: string) => void;
  onShowSettings: () => void;
  autoExpandTools: boolean;
  showRawParameters: boolean;
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
 * Tool usage information
 */
export interface ToolUsage {
  toolName: string;
  toolId?: string;
  toolInput?: any;
  isExpanded?: boolean;
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
  loadMore?: boolean
) => Promise<SessionMessage[]>;
export type ConvertSessionMessages = (
  rawMessages: SessionMessage[]
) => ChatMessage[];
export type FlattenFileTree = (
  files: FileTreeNode[], 
  prefix?: string
) => FileTreeNode[];

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
  timer: NodeJS.Timeout | null;
  isStreaming: boolean;
}

export default ChatInterfaceProps;