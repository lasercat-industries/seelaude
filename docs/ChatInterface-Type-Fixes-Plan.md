# ChatInterface.tsx Type Fixes Plan

## Overview
Fix 15 remaining `any` type issues in ChatInterface.tsx to improve type safety and maintainability.

## Current Issues
All 15 issues are `@typescript-eslint/no-explicit-any` errors at the following lines:
- 415, 425, 676, 687, 1111, 1182, 1257, 1394, 1430, 1453, 1525, 1584, 1682, 2010, 2085

## Implementation Plan

### Phase 1: Create Cursor Type Definitions
**Lines affected:** 415, 425, 676, 687

Create new file `src/ui/components/cursor-types.ts` with:
```typescript
interface CursorMessageBlob {
  role: 'user' | 'assistant' | 'system';
  content?: string | Array<{ text?: string; type?: string }>;
  timestamp?: string;
}

interface CursorSessionResponse {
  session?: {
    messages?: CursorMessageBlob[];
  };
}
```

**Changes needed:**
- Line 415: `Promise<any[]>` → `Promise<ChatMessage[]>`
- Line 425: `Record<string, any>` → `Record<string, ToolUseBlock>`
- Line 676: `(p: any)` → `(p: string | { text?: string })`
- Line 687: `const message: any` → `const message: ChatMessage`

### Phase 2: Fix Session Messages Cast
**Line affected:** 1111

- Change `setSessionMessages(messages as any)` to `setSessionMessages(messages)`
- The messages prop is already typed as `WebSocketMessage[]`

### Phase 3: Fix WebSocketMessage Data Casts
**Lines affected:** 1182, 1257, 1394, 1430, 1453, 1525, 1584, 1682

Create proper type guards or interfaces for each message type's data:

```typescript
// For claude-response (line 1182)
interface ClaudeResponseData {
  message?: Message;
  type?: string;
  delta?: { text: string };
}

// For cursor-tool-use (line 1257)
interface CursorToolUseData {
  tool?: { name: string };
  input?: unknown;
}

// For claude-output (lines 1394, 1430, 1453)
type ClaudeOutputData = CLIOutput;

// For cursor-result (line 1525)
interface CursorResultData {
  result?: string;
  is_error?: boolean;
}

// For cursor-output (line 1584)
type CursorOutputData = string;

// For claude-status (line 1682)
interface ClaudeStatusData {
  text?: string;
  thinking?: boolean;
  can_interrupt?: boolean;
}
```

**Implementation approach:**
- Use type assertions with proper intermediate types
- Cast as `unknown` first, then to specific type
- Example: `(latestMessage.data as unknown as ClaudeResponseData)`

### Phase 4: Fix Event Handler Types
**Lines affected:** 2010, 2085

- Line 2010: Change form submit handler parameter type
  - From: `(e: any)` 
  - To: `(e: React.FormEvent<HTMLFormElement>)`
  
- Line 2085: Change keyboard event handler parameter type
  - From: `(e: any)`
  - To: `(e: React.KeyboardEvent<HTMLTextAreaElement>)`

## Implementation Order

1. **Create cursor-types.ts file** with all new type definitions
2. **Import necessary SDK types** (`Message`, `CLIOutput`, `ToolUseBlock`)
3. **Fix Cursor API types** (Phase 1)
4. **Fix session messages cast** (Phase 2)
5. **Fix WebSocketMessage data casts** (Phase 3)
6. **Fix event handler types** (Phase 4)

## Benefits
- Type safety throughout the codebase
- Better IntelliSense support
- Easier refactoring
- Reduced runtime errors
- Clearer code intent

## Testing
After implementation:
1. Run `bun lint` to verify all any types are fixed
2. Run `bun typecheck` to ensure no new type errors
3. Test the UI to ensure functionality remains intact