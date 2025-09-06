# React Chat Interface Component Plan

## Overview

A responsive, feature-rich React component for a Claude chat interface that renders markdown, handles file uploads, and provides real-time streaming capabilities while remaining backend-agnostic.

## Component Architecture

```
src/ui/components/ChatInterface/
├── ChatInterface.tsx          // Main container component
├── MessageList.tsx           // Scrollable message list
├── MessageItem.tsx           // Individual message renderer
├── InputArea.tsx             // User input with file upload
├── ToolUseIndicator.tsx     // Tool usage visualization
├── FileUpdateLink.tsx        // File update event renderer
├── ThinkingIndicator.tsx     // "Claude is thinking" with token counter
└── types.ts                  // Component-specific types
```

## Component Specifications

### 1. Main Component: `ChatInterface.tsx`

**Props Interface:**

```typescript
interface ChatInterfaceProps {
  messages: SessionMessage[]; // Using server type directly
  streamingMessageId?: string; // ID of message being streamed
  streamBuffer?: string; // Current stream buffer
  toolResults?: Map<string, ToolResult>;
  onSendMessage: (message: string, files?: File[]) => void;
  onCancelCurrentWork?: () => void;
  onSessionCreated?: (sessionId: string) => void;
  onReplaceTemporarySession?: (realSessionId: string) => void;
  onNavigateToSession?: (sessionId: string) => void;
  onSessionInactive?: (sessionId: string) => void;
  editorType: 'vscode' | 'cursor';
  isThinking?: boolean;
  currentTokenCount?: number;
  maxTokens?: number;
  tokenVelocity?: number; // tokens per second
  claudeStatus?: { text: string; tokens: number; can_interrupt: boolean } | null;
  className?: string;
  cancelKeybind?: string; // default: 'Escape'
}
```

**Key Responsibilities:**

- Container for the entire chat interface
- Preprocesses tool results from messages (two-pass processing)
- Manages scroll position (auto-scroll to bottom on new messages)
- Handles keyboard shortcuts for cancellation
- Responsive container using Tailwind's flex layout
- Focus management for accessibility
- Filters out system/command messages from display

### 2. Sub-component: `MessageList.tsx`

**Features:**

- Virtual scrolling for performance with large message lists
- Auto-scroll to bottom when new messages arrive
- Smart detection if user has scrolled up (to prevent unwanted auto-scroll)
- Smooth scroll animations
- Loading states for streaming content
- Message grouping by time/user

**Props:**

```typescript
interface MessageListProps {
  messages: SessionMessage[]; // Use server type directly
  streamingMessageId?: string; // ID of message currently streaming
  streamBuffer?: string; // Current stream buffer content
  toolResults?: Map<string, ToolResult>; // Tool execution results
  editorType: 'vscode' | 'cursor';
  isThinking?: boolean;
  currentTokenCount?: number;
  maxTokens?: number;
}
```

### 3. Sub-component: `MessageItem.tsx`

**Handles rendering of SessionMessage:**

```typescript
interface MessageItemProps {
  message: SessionMessage;
  isStreaming?: boolean;
  streamBuffer?: string;
  toolResult?: ToolResult;
  editorType: 'vscode' | 'cursor';
}
```

**Rendering Logic:**

- Detect message type from `message.type` field
- For assistant messages with array content, iterate through ContentItems
- Use helper functions to detect tool use, file updates, etc.
- Preserve exact server data structure, compute UI state as needed

```typescript
const MessageItem: React.FC<MessageItemProps> = ({ message, isStreaming, streamBuffer }) => {
  const content = message.message?.content;

  if (typeof content === 'string') {
    // Simple text message
    return <ReactMarkdown>{isStreaming ? content + streamBuffer : content}</ReactMarkdown>;
  }

  if (isContentItemArray(content)) {
    // Complex content with potential tool use
    return (
      <>
        {content.map((item, idx) => {
          if (item.type === 'text') {
            return <ReactMarkdown key={idx}>{item.text}</ReactMarkdown>;
          }
          if (item.type === 'tool_use') {
            return <ToolUseIndicator key={idx} tool={item} result={toolResult} />;
          }
          return null;
        })}
      </>
    );
  }
};
```

**Message Processing Strategy:**

```typescript
// Process incoming WebSocketMessage and update SessionMessage array
const handleWebSocketMessage = (msg: WebSocketMessage, currentMessages: SessionMessage[]) => {
  switch (msg.type) {
    case 'claude-response':
      // Extract content and create/update SessionMessage
      const messageData = msg.data.message || msg.data;

      // Handle different response formats
      if (messageData.type === 'content_block_delta') {
        // Buffer streaming content
        streamBufferRef.current += messageData.delta?.text || '';
        // Flush buffer periodically (see stream buffering section)
      } else if (messageData.content) {
        // Create new SessionMessage using server type
        const newMessage: SessionMessage = {
          sessionId: currentSessionId,
          type: messageData.role || 'assistant',
          message: {
            role: messageData.role || 'assistant',
            content: messageData.content,
          },
          timestamp: new Date().toISOString(),
          uuid: messageData.uuid || generateUUID(),
        };
        return [...currentMessages, newMessage];
      }
      break;

    case 'claude-error':
      // Create error as system message
      const errorMessage: SessionMessage = {
        sessionId: currentSessionId,
        type: 'system',
        message: {
          role: 'system',
          content: `Error: ${msg.error}`,
        },
        timestamp: new Date().toISOString(),
      };
      return [...currentMessages, errorMessage];

    // Handle other message types...
  }
};
```

**Rendering Strategy:**

- Use ReactMarkdown for assistant messages
- Syntax highlighting for code blocks
- Copy button for code snippets
- Collapsible long messages
- Timestamp display with relative time

### 4. Sub-component: `InputArea.tsx`

**Features:**

- Textarea with auto-resize based on content
- File upload button with drag-and-drop support
- Send button (disabled while streaming)
- Keyboard shortcuts:
  - Cmd/Ctrl+Enter to send
  - Shift+Enter for new line (native behavior)
- Character count indicator
- File preview chips when files are attached
- Paste image from clipboard support

**Props:**

```typescript
interface InputAreaProps {
  onSendMessage: (message: string, files?: File[]) => void;
  isDisabled?: boolean;
  maxFileSize?: number; // in bytes
  allowedFileTypes?: string[];
  placeholder?: string;
}
```

### 5. Sub-component: `ToolUseIndicator.tsx`

**Visual representation of tool usage:**

```typescript
interface ToolUseIndicatorProps {
  toolName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input?: any;
  output?: any;
  isCollapsed?: boolean;
}
```

**Features:**

- Animated status indicators
- Collapsible details view
- Color-coded status (yellow=pending, blue=running, green=completed, red=failed)
- Formatted JSON display for input/output
- Special rendering for common tools:
  - Edit: Show file path and diff view
  - Write: Show file path and preview
  - Bash: Show command and terminal-style output
  - Read: Show file path and content preview

### 6. Sub-component: `ThinkingIndicator.tsx`

**"Claude is thinking" indicator with token counter:**

```typescript
interface ThinkingIndicatorProps {
  isActive: boolean;
  tokenCount?: number;
  tokenLimit?: number;
  tokenVelocity?: number; // tokens per second
  elapsedTime?: number; // in seconds
  currentAction?: 'thinking' | 'writing' | 'tool_running';
  toolName?: string;
}
```

**Features:**

- Animated dots (bouncing or pulsing) to show activity
- Real-time token counter with progress bar
- Token velocity indicator (tokens/second)
- Different states: "thinking", "writing", "running [tool]"
- Color-coded progress bar (green → yellow → red as approaching limit)
- Elapsed time counter
- Smooth transitions between states

**Visual Implementation:**

```jsx
<div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
  <div className="flex space-x-1">
    <span
      className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
      style={{ animationDelay: '0ms' }}
    />
    <span
      className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
      style={{ animationDelay: '150ms' }}
    />
    <span
      className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
      style={{ animationDelay: '300ms' }}
    />
  </div>
  <div className="flex-1">
    <div className="text-sm text-gray-700">
      Claude is {currentAction === 'tool_running' ? `running ${toolName}` : currentAction}...
    </div>
    {tokenCount && (
      <div className="mt-1">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{tokenCount.toLocaleString()} tokens</span>
          {tokenVelocity && <span>{tokenVelocity} tok/s</span>}
        </div>
        {tokenLimit && (
          <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                tokenCount / tokenLimit > 0.8
                  ? 'bg-red-500'
                  : tokenCount / tokenLimit > 0.6
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
              }`}
              style={{ width: `${(tokenCount / tokenLimit) * 100}%` }}
            />
          </div>
        )}
      </div>
    )}
  </div>
</div>
```

### 7. Sub-component: `FileUpdateLink.tsx`

**Props:**

```typescript
interface FileUpdateLinkProps {
  filePath: string;
  editorType: 'vscode' | 'cursor';
  operation: 'created' | 'modified' | 'deleted';
  lineNumber?: number;
}
```

**Renders:**

- Clickable link with appropriate protocol
  - VSCode: `vscode://file/{filePath}:{lineNumber}`
  - Cursor: `cursor://file/{filePath}:{lineNumber}`
- File icon based on extension
- Operation badge with color coding
- Hover preview of file path

## Implementation Details

### Responsive Design (Tailwind Classes)

```jsx
// Main container
<div className="flex flex-col h-full w-full min-h-0 bg-white dark:bg-gray-900">
  {/* Message list area */}
  <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
    <MessageList />
  </div>

  {/* Input area */}
  <div className="border-t border-gray-200 dark:border-gray-700 p-4">
    <InputArea />
  </div>
</div>
```

### Real-time Streaming Rendering

```jsx
// In MessageList - show thinking indicator
{
  isThinking && (
    <div className="flex items-start space-x-3 px-4 py-2">
      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
        <span className="text-white text-sm font-semibold">C</span>
      </div>
      <div className="flex-1">
        <ThinkingIndicator
          isActive={true}
          tokenCount={currentTokenCount}
          tokenLimit={maxTokens}
          tokenVelocity={tokenVelocity}
          currentAction={isStreaming ? 'writing' : 'thinking'}
        />
      </div>
    </div>
  );
}

// In MessageItem for assistant messages
{
  isStreaming && isLastMessage ? (
    <ReactMarkdown
      components={{
        code: CodeBlock,
        pre: PreBlock,
      }}
    >
      {message.content + currentStreamContent}
    </ReactMarkdown>
  ) : (
    <ReactMarkdown>{message.content}</ReactMarkdown>
  );
}
```

### Type Integration Strategy

```typescript
// Use existing server types directly - no new types needed
import type { SessionMessage, ContentItem } from '../shared/claude/types';
import type { WebSocketMessage } from '../server/claude/spawn-claude';
import { isContentItemArray, extractTextFromContentItem } from '../shared/claude/types';

// UI State Management (not a new type, just state)
interface ChatInterfaceState {
  messages: SessionMessage[]; // Use existing server type directly
  streamingMessageId?: string; // Track which message is currently streaming
  streamBuffer: string; // Buffer for incoming stream chunks
  toolResults: Map<string, ToolResult>; // Tool results indexed by tool ID
  isThinking: boolean;
  currentTokenCount: number;
}

// Helper functions to compute UI state from SessionMessage
const isToolUse = (msg: SessionMessage): boolean => {
  if (msg.message?.content && isContentItemArray(msg.message.content)) {
    return msg.message.content.some((item) => item.type === 'tool_use');
  }
  return false;
};

const extractToolData = (msg: SessionMessage) => {
  if (msg.message?.content && isContentItemArray(msg.message.content)) {
    const toolItem = msg.message.content.find((item) => item.type === 'tool_use');
    if (toolItem) {
      return {
        name: toolItem.name || 'unknown',
        input: toolItem.input,
        id: toolItem.id,
      };
    }
  }
  return null;
};

const extractFileUpdates = (msg: SessionMessage) => {
  if (msg.message?.content && isContentItemArray(msg.message.content)) {
    return msg.message.content
      .filter(
        (item) =>
          item.type === 'tool_use' &&
          (item.name === 'Edit' || item.name === 'Write' || item.name === 'MultiEdit'),
      )
      .map((item) => ({
        tool: item.name,
        file: item.input?.file_path,
        operation: item.name === 'Write' ? 'created' : 'modified',
      }));
  }
  return [];
};
```

## Event Processing Architecture

The chat interface is designed to be **transport-agnostic** - it doesn't know or care whether events come from WebSocket, Server-Sent Events, polling, or any other mechanism. The parent component is responsible for the transport layer and passes events through a generic event handler.

### Event Types

```typescript
// Generic event types (transport-agnostic)
type ClaudeEvent =
  | { type: 'session-created'; sessionId: string }
  | { type: 'claude-response'; data: any }
  | { type: 'claude-output'; data: string }
  | { type: 'claude-interactive-prompt'; data: string }
  | { type: 'claude-error'; error: string }
  | { type: 'claude-complete'; exitCode: number }
  | { type: 'session-aborted' }
  | { type: 'claude-status'; data: { text: string; tokens: number; can_interrupt: boolean } }
  | { type: 'content-block-delta'; delta: { text: string } }
  | { type: 'content-block-stop' };
```

### Event Handlers

#### 1. `session-created`

New session created by Claude CLI.

- Store session ID temporarily
- Replace temporary session identifiers in existing messages
- Trigger session protection callbacks

#### 2. `claude-response`

Main response event with multiple sub-formats:

- **content_block_delta**: Streaming text chunks - buffer and flush every 100ms
- **content_block_stop**: End of streaming - flush buffer, mark complete
- **system/init**: Session initialization - handle duplication bug
- **tool_use**: Tool execution - create tool indicator
- **text**: Regular content - add as message
- **tool_result**: Results - match to tool by ID

#### 3. `claude-output`

Raw CLI output - append to stream buffer with newline

#### 4. `claude-interactive-prompt`

CLI prompts - show as special message with input field

#### 5. `claude-error`

Errors - create system message with error styling

#### 6. `claude-complete`

Completion signal:

- Flush buffers
- Clear streaming states
- Mark session inactive
- Clear persisted messages if successful
- Trigger session refresh

#### 7. `session-aborted`

Abortion signal:

- Stop streaming
- Add interruption message
- Clear loading states

#### 8. `claude-status`

Status updates:

- Extract token count
- Update interrupt capability
- Show in ThinkingIndicator

### Stream Buffer Management

```typescript
const useStreamBuffer = () => {
  const bufferRef = useRef('');
  const timerRef = useRef<NodeJS.Timeout>();
  const FLUSH_INTERVAL = 100;

  const scheduleFlush = useCallback(() => {
    if (!timerRef.current) {
      timerRef.current = setTimeout(flushBuffer, FLUSH_INTERVAL);
    }
  }, []);

  const flushBuffer = useCallback(() => {
    if (bufferRef.current) {
      updateStreamingMessage(bufferRef.current);
      bufferRef.current = '';
    }
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
  }, []);

  const addToBuffer = (text: string) => {
    bufferRef.current += text;
    scheduleFlush();
  };

  return { addToBuffer, flushBuffer };
};
```

### Session Duplication Bug Handling

Claude CLI bug where resume creates new session:

```typescript
const handleSessionDuplication = (newId: string, currentId: string | null) => {
  if (currentId && newId !== currentId) {
    console.log('Session duplication:', { old: currentId, new: newId });
    setIsSystemSessionChange(true);
    onNavigateToSession?.(newId);
  }
};
```

### Keybind Handling

```jsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Cancel current work
    if (e.key === cancelKeybind && isStreaming) {
      e.preventDefault();
      onCancelCurrentWork?.();
    }

    // Send message (Cmd/Ctrl + Enter)
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isStreaming) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [isStreaming, cancelKeybind]);
```

## Usage Example

```jsx
function ChatPage() {
  const [messages, setMessages] = useState<SessionMessage[]>([]);  // Server type
  const [streamingMessageId, setStreamingMessageId] = useState<string>();
  const [streamBuffer, setStreamBuffer] = useState('');
  const streamBufferRef = useRef('');
  const streamTimerRef = useRef<NodeJS.Timeout>();
  const [isThinking, setIsThinking] = useState(false);
  const [sessionId, setSessionId] = useState<string>();
  const [tokenCount, setTokenCount] = useState(0);
  const [tokenVelocity, setTokenVelocity] = useState(0);
  const lastTokenUpdate = useRef({ count: 0, time: Date.now() });

  // Memoize tool result processing
  const toolResults = useMemo(() => {
    return preprocessToolResults(messages);
  }, [messages]);

  // Stream buffer management
  const flushStreamBuffer = useCallback(() => {
    if (streamBufferRef.current) {
      setMessages(prev => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg && lastMsg.uuid === streamingMessageId) {
          // Update existing message content
          if (typeof lastMsg.message?.content === 'string') {
            lastMsg.message.content += streamBufferRef.current;
          }
        } else {
          // Create new streaming message
          const newMsg: SessionMessage = {
            sessionId: sessionId || 'temp',
            type: 'assistant',
            message: {
              role: 'assistant',
              content: streamBufferRef.current
            },
            timestamp: new Date().toISOString(),
            uuid: generateUUID()
          };
          updated.push(newMsg);
          setStreamingMessageId(newMsg.uuid);
        }
        return updated;
      });
      setStreamBuffer(streamBufferRef.current);
      streamBufferRef.current = '';
    }
    streamTimerRef.current = undefined;
  }, [sessionId, streamingMessageId]);

  const handleSendMessage = async (content: string, files?: File[]) => {
    setIsThinking(true);
    setTokenCount(0);

    // Create user message using server type
    const userMessage: SessionMessage = {
      sessionId: sessionId || 'temp',
      type: 'user',
      message: {
        role: 'user',
        content: content
      },
      timestamp: new Date().toISOString(),
      uuid: generateUUID()
    };
    setMessages(prev => [...prev, userMessage]);

    // Handle WebSocket communication
    const { stream, onMessage } = createStreamWrapper();

    onMessage((msg: WebSocketMessage) => {
      switch (msg.type) {
        case 'session-created':
          setSessionId(msg.sessionId);
          // Update temp session IDs in existing messages
          setMessages(prev => prev.map(m => ({
            ...m,
            sessionId: msg.sessionId || m.sessionId
          })));
          break;

        case 'claude-response':
          handleClaudeResponse(msg);
          break;

        case 'claude-complete':
          flushStreamBuffer();
          setStreamingMessageId(undefined);
          setIsThinking(false);
          break;
      }
    });

    await spawnClaude(content, { sessionId }, stream);
  };

  // Memoize converted messages for display (filters out system messages)
  const displayMessages = useMemo(() => {
    return messages.filter(msg => {
      if (msg.type === 'user') {
        return !!extractUserMessageText(msg);
      }
      // Keep all assistant messages, filter system based on content
      if (msg.type === 'system') {
        const content = typeof msg.message?.content === 'string' ? msg.message.content : '';
        return !shouldSkipMessage(content);
      }
      return true;
    });
  }, [messages]);

  return (
    <ChatInterface
      messages={displayMessages}  // Pass filtered messages
      streamingMessageId={streamingMessageId}
      streamBuffer={streamBuffer}
      toolResults={toolResults}
      onSendMessage={handleSendMessage}
      onCancelCurrentWork={() => sessionId && abortClaudeSession(sessionId)}
      editorType="vscode"
      isThinking={isThinking}
      currentTokenCount={tokenCount}
      tokenVelocity={tokenVelocity}
      maxTokens={8000}
      className="h-screen"
    />
  );
}
```

## Mobile Optimizations

- **Touch-friendly targets**: Minimum 44px tap targets for all buttons
- **Viewport-aware keyboard**: Adjust layout when virtual keyboard appears
- **Swipe gestures**:
  - Swipe left on message for actions (copy, retry)
  - Pull-to-refresh for reloading session
- **Responsive typography**:
  - Base: `text-sm md:text-base`
  - Code: `text-xs md:text-sm`
- **Bottom sheet pattern**: File upload modal slides up from bottom on mobile
- **Responsive padding**: `p-2 sm:p-4`

## Accessibility Features

- **ARIA labels**: All interactive elements have descriptive labels
- **Keyboard navigation**:
  - Tab through messages
  - Arrow keys for message selection
  - Enter to expand collapsed content
- **Screen reader support**:
  - Announce new messages
  - Status updates for streaming
  - Tool usage notifications
- **Focus management**:
  - Focus returns to input after sending
  - Focus trap in modals
- **High contrast mode**: Via Tailwind's `dark:` variants
- **Motion preferences**: Respect `prefers-reduced-motion`

## Performance Considerations

1. **Virtual scrolling**: Use `react-window` for message lists > 100 items
2. **Memo optimization**: Wrap components in `React.memo`
3. **Debounced input**: Debounce file preview generation
4. **Lazy loading**: Code splitting for markdown renderer
5. **Image optimization**: Compress uploaded images before sending
6. **Stream buffering**: Buffer stream updates to reduce re-renders
7. **Token counter throttling**: Update token display at most every 100ms
8. **Animation performance**: Use CSS transforms for dots animation

## Error Handling

- Network error recovery with retry logic
- Graceful degradation for unsupported file types
- User-friendly error messages
- Fallback rendering for malformed messages
- Session recovery after connection loss

## Future Enhancements

1. **Message search**: Full-text search across conversation
2. **Export functionality**: Download chat as markdown/PDF
3. **Theme customization**: User-configurable color schemes
4. **Voice input**: Speech-to-text for message input
5. **Message reactions**: Thumbs up/down feedback
6. **Code execution**: Run code snippets in sandboxed environment
7. **Collaborative sessions**: Multiple users in same chat
8. **Message threading**: Reply to specific messages

## Dependencies

- `react`: ^18.0.0
- `react-markdown`: ^9.0.0
- `tailwindcss`: ^3.0.0
- `react-window`: ^1.8.0 (for virtual scrolling)
- `@tailwindcss/typography`: ^0.5.0 (for prose styles)
- `react-dropzone`: ^14.0.0 (for file uploads)
- `date-fns`: ^3.0.0 (for timestamp formatting)
- `framer-motion`: ^11.0.0 (optional, for smooth animations)

## Testing Strategy

1. **Unit tests**: Each component in isolation
2. **Integration tests**: Message flow and streaming
3. **E2E tests**: Full chat interaction flow
4. **Accessibility tests**: Screen reader and keyboard navigation
5. **Performance tests**: Large message lists and streaming
6. **Visual regression**: Screenshot comparisons

## Implementation Phases

### Phase 1: Read-Only Message Display ✅

**Goal**: Display existing session messages without interactivity

- [ ] Create basic `ChatInterface` component structure
- [ ] Implement `MessageList` component with virtual scrolling
- [ ] Create `MessageBubble` component with role-based styling
- [ ] Implement `MessageContent` with ReactMarkdown rendering
- [ ] Add syntax highlighting for code blocks
- [ ] Create `ToolUsage` component for tool call display
- [ ] Implement message conversion from server format (`convertSessionMessages`)
- [ ] Add proper TypeScript types using shared types
- [ ] Style with Tailwind CSS (light/dark mode support)
- [ ] Add timestamp display with relative formatting
- [ ] Test with sample session data from Claude CLI

**Acceptance Criteria**:

- Can load and display messages from an existing session
- Messages render with proper formatting (markdown, code blocks)
- Tool usage is clearly indicated
- Responsive layout works on mobile and desktop
- Virtual scrolling handles large message lists efficiently

### Phase 2: Streaming Message Support

**Goal**: Display real-time streaming messages from Claude

- [ ] Add streaming state management (`streamBuffer`, `streamingMessageId`)
- [ ] Implement stream buffering with debounced updates
- [ ] Create "thinking" indicator component
- [ ] Add token counter display
- [ ] Implement progressive message updates
- [ ] Handle stream completion and error states
- [ ] Add tool result correlation logic
- [ ] Implement smooth auto-scroll during streaming
- [ ] Add stream interruption handling
- [ ] Test with actual Claude API streaming

**Acceptance Criteria**:

- Streaming messages appear progressively
- "Thinking" indicator shows during processing
- Token count updates in real-time
- Tool usage and results display correctly
- Performance remains smooth during streaming

### Phase 3: User Input and Interaction

**Goal**: Allow users to send messages and interact with the chat

- [ ] Create `MessageInput` component with auto-resize
- [ ] Add file upload support with drag-and-drop
- [ ] Implement keyboard shortcuts (Enter to send, etc.)
- [ ] Add message editing capability
- [ ] Create session management UI
- [ ] Add copy code button for code blocks
- [ ] Implement message retry functionality
- [ ] Add conversation branching UI
- [ ] Create settings panel for model/parameters
- [ ] Add export/import conversation feature

**Acceptance Criteria**:

- Users can type and send messages
- File uploads work with preview
- All keyboard shortcuts function correctly
- Settings persist between sessions
- Export produces valid session format

### Phase 4: Advanced Features (Future)

**Goal**: Add power-user features and optimizations

- [ ] Add search within conversation
- [ ] Implement message bookmarking
- [ ] Add conversation templates
- [ ] Create custom prompt library
- [ ] Add voice input/output support
- [ ] Implement collaborative sessions
- [ ] Add analytics dashboard
- [ ] Create plugin system for extensions

## Current Status

**Active Phase**: Phase 1 - Read-Only Message Display
**Next Steps**:

1. Set up basic component structure
2. Implement message rendering with sample data
3. Add virtual scrolling for performance
