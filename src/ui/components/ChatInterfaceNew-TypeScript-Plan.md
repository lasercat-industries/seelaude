# ChatInterfaceNew TypeScript Conversion Plan

## Quick Start Checklist

### Prerequisites

- [ ] Backup current ChatInterfaceNew.tsx file
- [ ] Ensure dev server is running and working
- [ ] Have TypeScript docs handy for reference

### Estimated Time: ~2-3 hours for full conversion

## EXISTING TYPES FOUND IN REPO

### From `@shared/claude/types.ts`:

- `SessionMessage` - Full message structure with sessionId, type, message, timestamp
- `ClaudeSession` - Session with id, summary, title, lastActivity, messageCount, created
- `ClaudeProject` - Project with name, path, displayName, fullPath, sessions
- `ContentItem`, `TextContentItem` - Content structure types
- `MessageContent` - string | SpecificContentItem[]

### From `@shared/types.ts`:

- `WebSocket` - WebSocket interface
- `WebSocketMessage` - WebSocket message types
- `OutgoingMessage` - ClaudeCommandMessage | AbortSessionMessage

### From UI Components:

- `ExtendedMessage` (MessageComponent.tsx) - Extends SessionMessage with UI-specific fields
- `MessageComponentProps` (MessageComponent.tsx) - Props for message component
- `TasksSettingsContextType` (TasksSettingsContext.tsx) - Tasks context

### From WebSocketContext:

- WebSocket context value type with ws, sendMessage, messages, isConnected

## Current Issues

### 1. Missing Type Definitions for Props and Components

#### Main Component Props (Line 1355)

- No interface defined for component props
- All parameters implicitly `any`
- Props needed: selectedProject, selectedSession, sendMessage, messages, onFileOpen, onInputFocusChange, onSessionActive, onSessionInactive, onReplaceTemporarySession, onNavigateToSession, onShowSettings, autoExpandTools, showRawParameters, autoScrollToBottom, sendByCtrlEnter, onShowAllTasks

#### Memoized Component Props (Lines 172-179)

- `MessageBlock` component needs proper prop types
- Properties not defined on empty object type

#### Helper Components (Line 1311)

- `ImageAttachment` needs typed props

### 2. State and Variable Types

#### State Variables (need explicit types):

- `chatMessages` - array of message objects
- `sessionMessages` - array of raw session messages
- `uploadedImages` - array of uploaded images
- `attachedFiles` - array of attached files
- `fileTree` - nested file structure
- `claudeStatus` - status object or null
- Multiple refs need proper typing

### 3. Function Parameter Types

Functions with implicit `any` parameters:

- `createDiff` (line 1430)
- `loadSessionMessages` (line 1445)
- `loadCursorSessionMessages` (line 1492)
- `convertSessionMessages` (line 1838)
- `handlePaste` (line 2995)
- `handleDrop` (line 3035)
- Event handlers with untyped `e` parameters

### 4. API and External Types

#### Missing API types:

- `api.getFiles` doesn't exist in current API type (line 2778)
- Response types from API calls need definition

#### Window extensions:

- `window.refreshProjects` (lines 2631, 2696)

#### External data types:

- Message types from WebSocket
- Session and project structures
- Tool usage data structures

### 5. React and DOM Types

- Refs not properly typed (scrollContainerRef, textareaRef, etc.)
- Event handlers need proper event types
- ReactMarkdown component props

### 6. Utility Function Types

- `formatUsageLimitText` (line 31)
- `parseAnsiToHtml` (line 92)
- `flattenFileTree` (line 2790)

## Implementation Plan with Checklist

### Phase 1: Create Type Definitions File

- [x] Create `ChatInterfaceNew.types.ts` file
- [x] Import existing types from `@shared/claude/types` and `@shared/types`
- [x] Define `ChatInterfaceProps` interface
- [x] Define `UploadedImage` interface
- [x] Define `AttachedFile` interface
- [x] Define `FileTreeNode` interface
- [x] Define `ClaudeStatus` interface
- [x] Export all new types

### Phase 2: Update Component Declaration

- [ ] Import types from `ChatInterfaceNew.types.ts`
- [ ] Add `ChatInterfaceProps` type to function signature
- [ ] Remove the `@ts-ignore` comment at top of file
- [ ] Update function declaration: `function ChatInterface(props: ChatInterfaceProps)`
- [ ] Destructure props with proper typing

### Phase 3: Type State Variables

- [ ] Type `chatMessages` state as `ExtendedMessage[]`
- [ ] Type `sessionMessages` state as `SessionMessage[]`
- [ ] Type `uploadedImages` state as `UploadedImage[]`
- [ ] Type `attachedFiles` state as `AttachedFile[]`
- [ ] Type `fileTree` state as `FileTreeNode[]`
- [ ] Type `claudeStatus` state as `ClaudeStatus | null`
- [ ] Type `input` state as `string`
- [ ] Type `isLoading` state as `boolean`
- [ ] Type `currentSessionId` state as `string | null`
- [ ] Type all other boolean states
- [ ] Type numeric states (messagesOffset, totalMessages, etc.)

### Phase 4: Type Refs

- [ ] Type `scrollContainerRef` as `useRef<HTMLDivElement>(null)`
- [ ] Type `textareaRef` as `useRef<HTMLTextAreaElement>(null)`
- [ ] Type `fileInputRef` as `useRef<HTMLInputElement>(null)`
- [ ] Type `streamBufferRef` as `useRef<string>('')`
- [ ] Type `streamTimerRef` as `useRef<NodeJS.Timeout | null>(null)`
- [ ] Type `messageRef` as `useRef<HTMLDivElement>(null)`
- [ ] Type `uploadProgressRef` as `useRef<Map<string, number>>(new Map())`
- [ ] Type `temporarySessionIdRef` as `useRef<string | null>(null)`

### Phase 5: Type Event Handlers

- [ ] Type `handlePaste` parameter as `React.ClipboardEvent<HTMLTextAreaElement>`
- [ ] Type `handleDrop` parameter as `React.DragEvent<HTMLDivElement>`
- [ ] Type `handleKeyDown` parameter as `React.KeyboardEvent<HTMLTextAreaElement>`
- [ ] Type `handleInputChange` parameter as `React.ChangeEvent<HTMLTextAreaElement>`
- [ ] Type `handleSubmit` parameter as `React.FormEvent<HTMLFormElement>`
- [ ] Type `handleFileSelect` parameter as `React.ChangeEvent<HTMLInputElement>`
- [ ] Type all onClick handlers as `React.MouseEvent<HTMLButtonElement>`
- [ ] Type onFocus/onBlur handlers appropriately

### Phase 6: Type Helper Functions

- [ ] Type `formatUsageLimitText` parameters and return type
- [ ] Type `parseAnsiToHtml` parameters and return type
- [ ] Type `createDiff` parameters and return type
- [ ] Type `loadSessionMessages` parameters and return type
- [ ] Type `loadCursorSessionMessages` parameters and return type
- [ ] Type `convertSessionMessages` parameters and return type
- [ ] Type `flattenFileTree` parameters and return type
- [ ] Type `handleTranscript` parameters
- [ ] Type `loadEarlierMessages` function
- [ ] Add return types to all useCallback functions

### Phase 7: Fix API and External Types

- [ ] Add `getFiles` method to api.ts or create extended interface
- [ ] Define window.refreshProjects type augmentation
- [ ] Create global.d.ts for window extensions
- [ ] Add type for ImageAttachment component props
- [ ] Type the useDropzone configuration
- [ ] Fix ReactMarkdown component props typing

### Phase 8: Type Memoized Components

- [ ] Type MessageBlock component props interface
- [ ] Fix the memo wrapper typing for MessageBlock
- [ ] Type all props passed to MessageBlock
- [ ] Type ImageAttachment component and its props
- [ ] Ensure all child components receive typed props

### Phase 9: Fix Remaining Type Errors

- [ ] Fix arithmetic operation type errors (lines 1789)
- [ ] Fix window.refreshProjects references
- [ ] Fix api.getFiles method call
- [ ] Fix clipboard data type assertions
- [ ] Fix file upload type assertions
- [ ] Type the reasoning property on messages

### Phase 10: Testing and Validation

- [ ] Run `npx tsc --noEmit` to check for type errors
- [ ] Run `npm run typecheck` to validate
- [ ] Fix any remaining type errors
- [ ] Test component functionality hasn't broken
- [ ] Run linter to check for new issues
- [ ] Verify hot reload still works in dev mode

## Types to Define (After Reusing Existing)

### Types We Can Reuse:

- ✅ Use `SessionMessage` from `@shared/claude/types` instead of creating new
- ✅ Use `ClaudeSession` as base for Session type (just alias or extend if needed)
- ✅ Use `ClaudeProject` for Project type
- ✅ Use `WebSocketMessage` from `@shared/types`
- ✅ Use `WebSocket` from `@shared/types`
- ✅ Use `ExtendedMessage` from MessageComponent for chat messages
- ✅ Use `OutgoingMessage` for sendMessage parameter type

### New Types Still Needed

```typescript
// ChatMessage can extend ExtendedMessage from MessageComponent
type ChatMessage = ExtendedMessage & {
  isStreaming?: boolean;
  files?: AttachedFile[];
};

// Use ClaudeProject and ClaudeSession directly, no need to redefine

interface UploadedImage {
  id: string;
  url: string;
  file: File;
  status: 'uploading' | 'uploaded' | 'error';
  progress?: number;
  error?: string;
}

interface AttachedFile {
  path: string;
  name: string;
  content?: string;
}

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

interface ClaudeStatus {
  text: string;
  tokens: number;
  can_interrupt: boolean;
}
```

## Priority Order

1. **High Priority** - Breaking functionality:
   - Component props interface
   - State types
   - Event handler types

2. **Medium Priority** - Type safety:
   - Function parameter types
   - Return types
   - Ref types

3. **Low Priority** - Nice to have:
   - Utility function types
   - Complete API typing
   - Global augmentations

## Notes

- Check for existing types in `@shared/claude/types` before creating new ones
- Use existing types from other components where possible
- Consider creating a shared types file for the UI layer
- Maintain backward compatibility during conversion
