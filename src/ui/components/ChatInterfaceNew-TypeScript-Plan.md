# ChatInterfaceNew TypeScript Conversion Plan

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

## Implementation Plan

### Phase 1: Create Type Definitions File
Create `ChatInterfaceNew.types.ts`:
- Define all message types
- Define component prop interfaces
- Define state shape types
- Define API response types

### Phase 2: Add Component Props Interface
```typescript
import type { ClaudeProject, ClaudeSession, SessionMessage } from '@shared/claude/types';
import type { WebSocketMessage, OutgoingMessage } from '@shared/types';

interface ChatInterfaceProps {
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
```

### Phase 3: Type State Variables
```typescript
const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
const [sessionMessages, setSessionMessages] = useState<SessionMessage[]>([]);
const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
const [claudeStatus, setClaudeStatus] = useState<ClaudeStatus | null>(null);
```

### Phase 4: Type Refs
```typescript
const scrollContainerRef = useRef<HTMLDivElement>(null);
const textareaRef = useRef<HTMLTextAreaElement>(null);
const fileInputRef = useRef<HTMLInputElement>(null);
const streamBufferRef = useRef<string>('');
const streamTimerRef = useRef<NodeJS.Timeout | null>(null);
```

### Phase 5: Type Event Handlers
```typescript
const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
  // ...
}

const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
  // ...
}

const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  // ...
}
```

### Phase 6: Type Helper Functions
- Add return types to all functions
- Add parameter types to all functions
- Use generics where appropriate

### Phase 7: Fix API Types
Update `api.ts` to include:
```typescript
interface API {
  sessionMessages: (projectName: string, sessionId: string, limit?: number | null, offset?: number) => Promise<Response>;
  config: () => Promise<Response>;
  projects?: () => Promise<Response>;
  sessions?: (projectName: string, limit?: number, offset?: number) => Promise<Response>;
  getFiles?: (projectName: string) => Promise<Response>;
}
```

### Phase 8: Type External Dependencies
- Create type declarations for window extensions
- Import proper types from shared modules
- Define global augmentations for window object

### Phase 9: Fix Component Prop Drilling
- Ensure all child components receive properly typed props
- Update MessageBlock and other memoized components

### Phase 10: Testing and Validation
- Run TypeScript compiler with strict mode
- Fix any remaining type errors
- Ensure no functionality is broken

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