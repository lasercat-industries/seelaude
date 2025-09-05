import type {
  Message,
  CLIOutput,
} from '@instantlyeasy/claude-code-sdk-ts';
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
    | 'claude-output';
  sessionId?: string;
  data?: Message | CLIOutput | unknown;
  error?: string;
  exitCode?: number;
  isNewSession?: boolean;
  tool?: unknown;
}

export type AbortSessionMessage = {
  type: "abort-session";
  sessionId: string;
  provider: string;
};

export type OutgoingMessage = ClaudeCommandMessage | AbortSessionMessage;
