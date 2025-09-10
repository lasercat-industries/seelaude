import type {
  ClaudeCommandMessage,
  ClaudePermissionMessage,
  Message,
  PermissionPayload,
} from './claude/types';

export interface WebSocket {
  send: (data: string) => void;
  readyState?: number;
  close?: () => void;
}

export interface WebSocketMessage {
  type:
    | 'session-created'
    | 'claude-response'
    | 'claude-error'
    | 'claude-complete'
    | 'claude-output'
    | 'claude-interactive-prompt'
    | 'claude-status'
    | 'session-aborted'
    | 'cursor-system'
    | 'cursor-user'
    | 'cursor-tool-use'
    | 'cursor-error'
    | 'cursor-result'
    | 'cursor-output'
    | 'permission-request';
  sessionId?: string;
  data?: Message | unknown;
  permissionPayload?: PermissionPayload;
  error?: string;
  exitCode?: number;
  isNewSession?: boolean;
  tool?: unknown;
  input?: string; // For cursor-tool-use
}

export type AbortSessionMessage = {
  type: 'abort-session';
  sessionId: string;
  provider: string;
};

export type OutgoingMessage = ClaudeCommandMessage | AbortSessionMessage | ClaudePermissionMessage;
