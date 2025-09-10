import type {
  BashInput,
  FileEditInput,
  FileMultiEditInput,
  FileWriteInput,
  GlobInput,
  McpInput,
  WebFetchInput,
  WebSearchInput,
} from '@anthropic-ai/claude-code/sdk-tools';

export enum ToolType {
  Read = 'Read',
  Write = 'Write',
  Edit = 'Edit',
  Bash = 'Bash',
  Grep = 'Grep',
  Glob = 'Glob',
  LS = 'LS',
  MultiEdit = 'MultiEdit',
  NotebookRead = 'NotebookRead',
  NotebookEdit = 'NotebookEdit',
  WebFetch = 'WebFetch',
  TodoRead = 'TodoRead',
  TodoWrite = 'TodoWrite',
  WebSearch = 'WebSearch',
  Task = 'Task',
  MCPTool = 'MCPTool',
}

export const ApprovableTools = [
  ToolType.Write,
  ToolType.Edit,
  ToolType.Bash,
  ToolType.MultiEdit,
  ToolType.Glob,
  ToolType.WebSearch,
  ToolType.WebFetch,
  ToolType.Bash,
  ToolType.MCPTool,
] as const;

type ApprovableTool = (typeof ApprovableTools)[number];

export function isApprovableTool(value: string): value is ApprovableTool {
  return (ApprovableTools as readonly string[]).includes(value);
}

type ApprovableInputs =
  | BashInput
  | FileEditInput
  | FileMultiEditInput
  | FileWriteInput
  | GlobInput
  | WebFetchInput
  | WebSearchInput
  | McpInput;

export type PermissionPayload = {
  toolName: ApprovableTool;
  input: ApprovableInputs;
  requestId: string;
};

export function isBashInput(value: unknown): value is BashInput {
  return (
    typeof value === 'object' && value !== null && typeof (value as BashInput).command === 'string'
  );
}

// FileEditInput
export function isFileEditInput(value: unknown): value is FileEditInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as FileEditInput).file_path === 'string' &&
    typeof (value as FileEditInput).old_string === 'string' &&
    typeof (value as FileEditInput).new_string === 'string'
  );
}

export interface FileEditOperation {
  /**
   * The text to replace
   */
  old_string: string;
  /**
   * The text to replace it with
   */
  new_string: string;
  /**
   * Replace all occurrences of old_string (default false).
   */
  replace_all?: boolean;
}

// FileMultiEditInput
export function isFileMultiEditInput(value: unknown): value is FileMultiEditInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as FileMultiEditInput).file_path === 'string' &&
    Array.isArray((value as FileMultiEditInput).edits) &&
    (value as FileMultiEditInput).edits.length > 0 &&
    (value as FileMultiEditInput).edits.every(
      (edit: FileEditOperation) =>
        typeof edit.old_string === 'string' && typeof edit.new_string === 'string',
    )
  );
}

// FileWriteInput
export function isFileWriteInput(value: unknown): value is FileWriteInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as FileWriteInput).file_path === 'string' &&
    typeof (value as FileWriteInput).content === 'string'
  );
}

// GlobInput
export function isGlobInput(value: unknown): value is GlobInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as GlobInput).pattern === 'string' &&
    ((value as GlobInput).path === undefined || typeof (value as GlobInput).path === 'string')
  );
}

// WebFetchInput
export function isWebFetchInput(value: unknown): value is WebFetchInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as WebFetchInput).url === 'string' &&
    typeof (value as WebFetchInput).prompt === 'string'
  );
}

// WebSearchInput
export function isWebSearchInput(value: unknown): value is WebSearchInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as WebSearchInput).query === 'string' &&
    ((value as WebSearchInput).allowed_domains === undefined ||
      Array.isArray((value as WebSearchInput).allowed_domains)) &&
    ((value as WebSearchInput).blocked_domains === undefined ||
      Array.isArray((value as WebSearchInput).blocked_domains))
  );
}

// McpInput (catch-all, since it’s just Record<string, unknown>)
export function isMcpInput(value: unknown): value is McpInput {
  return typeof value === 'object' && value !== null;
}
