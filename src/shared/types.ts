import type { Message, CLIOutput } from '@lasercat/claude-code-sdk-ts';
import type { ClaudeCommandMessage } from './claude/types';

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
    | 'cursor-output';
  sessionId?: string;
  data?: Message | CLIOutput | unknown;
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

export type CursorCommandMessage = {
  type: 'cursor-command';
  command: string;
  projectPath?: string;
  sessionId?: string | null;
  permissionMode?: string;
  model?: string;
};

export type OutgoingMessage = ClaudeCommandMessage | AbortSessionMessage | CursorCommandMessage;
