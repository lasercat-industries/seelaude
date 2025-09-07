/*
 * ChatInterface.jsx - Chat Component with Session Protection Integration
 *
 * SESSION PROTECTION INTEGRATION:
 * ===============================
 *
 * This component integrates with the Session Protection System to prevent project updates
 * from interrupting active conversations:
 *
 * Key Integration Points:
 * 1. handleSubmit() - Marks session as active when user sends message (including temp ID for new sessions)
 * 2. session-created handler - Replaces temporary session ID with real WebSocket session ID
 * 3. claude-complete handler - Marks session as inactive when conversation finishes
 * 4. session-aborted handler - Marks session as inactive when conversation is aborted
 *
 * This ensures uninterrupted chat experience by coordinating with App.jsx to pause sidebar updates.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import ClaudeLogo from './ClaudeLogo';
import ClaudeStatus from './ClaudeStatus';
import ImageAttachment from './ImageAttachment';
import { api } from '../utils/api';
import { safeLocalStorage } from '../utils/safeLocalStorage';
import { MessageComponent } from './MessageComponent';
import type {
  ChatInterfaceProps,
  ChatMessage,
  UploadedImage,
  FileTreeNode,
  ClaudeStatus as ClaudeStatusType,
} from './types.js';
import type { SessionMessage } from '@shared/claude/types';
import type { Message, AssistantMessage } from '@lasercat/claude-code-sdk-ts';
import type {
  ClaudeResponseData,
  ClaudeStatusData,
  StreamingMessageData,
  ToolResultMessage,
  UserMessageWithToolResults,
} from './claudeTypes.js';
import { claudeCodeModels, defaultClaudeModel } from '../utils/claudeModels';

// Safe localStorage utility to handle quota exceeded errors

function formatUsageLimitText(text: string | unknown): string | unknown {
  try {
    if (typeof text !== 'string') return text;
    return text.replace(/Claude AI usage limit reached\|(\d{10,13})/g, (match, ts) => {
      let timestampMs = parseInt(ts, 10);
      if (!Number.isFinite(timestampMs)) return match;
      if (timestampMs < 1e12) timestampMs *= 1000; // seconds → ms
      const reset = new Date(timestampMs);

      // Time HH:mm in local time
      const timeStr = new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(reset);

      // Human-readable timezone: GMT±HH[:MM] (City)
      const offsetMinutesLocal = -reset.getTimezoneOffset();
      const sign = offsetMinutesLocal >= 0 ? '+' : '-';
      const abs = Math.abs(offsetMinutesLocal);
      const offH = Math.floor(abs / 60);
      const offM = abs % 60;
      const gmt = `GMT${sign}${offH}${offM ? ':' + String(offM).padStart(2, '0') : ''}`;
      const tzId = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const cityRaw = tzId.split('/').pop() || '';
      const city = cityRaw
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const tzHuman = city ? `${gmt} (${city})` : gmt;

      // Readable date like "8 Jun 2025"
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const dateReadable = `${reset.getDate()} ${months[reset.getMonth()]} ${reset.getFullYear()}`;

      return `Claude usage limit reached. Your limit will reset at **${timeStr} ${tzHuman}** - ${dateReadable}`;
    });
  } catch {
    return text;
  }
}

// ChatInterface: Main chat component with Session Protection System integration
//
// Session Protection System prevents automatic project updates from interrupting active conversations:
// - onSessionActive: Called when user sends message to mark session as protected
// - onSessionInactive: Called when conversation completes/aborts to re-enable updates
// - onReplaceTemporarySession: Called to replace temporary session ID with real WebSocket session ID
//
// This ensures uninterrupted chat experience by pausing sidebar refreshes during conversations.
function ChatInterface({
  selectedProject,
  selectedSession,
  sendMessage,
  messages,
  onFileOpen,
  onInputFocusChange,
  onSessionActive,
  onSessionInactive,
  onReplaceTemporarySession,
  onShowSettings,
  autoExpandTools,
  showRawParameters,
  autoScrollToBottom,
  sendByCtrlEnter,
}: ChatInterfaceProps) {
  const [input, setInput] = useState<string>(() => {
    if (typeof window !== 'undefined' && selectedProject) {
      return safeLocalStorage.getItem(`draft_input_${selectedProject.name}`) || '';
    }
    return '';
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined' && selectedProject) {
      const saved = safeLocalStorage.getItem(`chat_messages_${selectedProject.name}`);
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    selectedSession?.id || null,
  );
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);
  const [sessionMessages, setSessionMessages] = useState<SessionMessage[]>([]);
  const [isLoadingSessionMessages, setIsLoadingSessionMessages] = useState<boolean>(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState<boolean>(false);
  const [messagesOffset, setMessagesOffset] = useState<number>(0);
  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(false);
  const [totalMessages, setTotalMessages] = useState<number>(0);
  const MESSAGES_PER_PAGE = 20;
  const [isSystemSessionChange, setIsSystemSessionChange] = useState<boolean>(false);
  const [permissionMode, setPermissionMode] = useState<string>('default');
  const [attachedImages, setAttachedImages] = useState<UploadedImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState<Map<string, number>>(new Map());
  const [imageErrors, setImageErrors] = useState<Map<string, string>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  // Streaming throttle buffers
  const streamBufferRef = useRef<string>('');
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFileDropdown, setShowFileDropdown] = useState<boolean>(false);
  const [fileList, setFileList] = useState<FileTreeNode[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileTreeNode[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(-1);
  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const [atSymbolPosition, setAtSymbolPosition] = useState<number>(-1);
  const [canAbortSession, setCanAbortSession] = useState<boolean>(false);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState<boolean>(false);
  const scrollPositionRef = useRef<{ height: number; top: number }>({ height: 0, top: 0 });
  // const [showCommandMenu, setShowCommandMenu] = useState(false);
  // const [slashCommands, setSlashCommands] = useState([]);
  // const [filteredCommands, setFilteredCommands] = useState([]);
  const [isTextareaExpanded, setIsTextareaExpanded] = useState<boolean>(false);
  // const [selectedCommandIndex, setSelectedCommandIndex] = useState(-1);
  // const [slashPosition, setSlashPosition] = useState(-1);
  const [visibleMessageCount, setVisibleMessageCount] = useState<number>(100);
  const [claudeStatus, setClaudeStatus] = useState<ClaudeStatusType | null>(null);
  const [provider, setProvider] = useState<string>(() => {
    return localStorage.getItem('selected-provider') || 'claude';
  });
  const [claudeModel, setClaudeModel] = useState<string>(() => {
    return localStorage.getItem('claude-model') || defaultClaudeModel.alias;
  });
  // When selecting a session from Sidebar, auto-switch provider to match session's origin
  useEffect(() => {
    if (selectedSession && selectedSession.__provider && selectedSession.__provider !== provider) {
      setProvider(selectedSession.__provider);
      localStorage.setItem('selected-provider', selectedSession.__provider);
    }
  }, [selectedSession]);

  // Memoized diff calculation to prevent recalculating on every render
  const createDiff = useMemo(() => {
    const cache = new Map<
      string,
      Array<{ type: string; content: string | undefined; lineNum: number }>
    >();
    return (
      oldStr: string,
      newStr: string,
    ): Array<{ type: string; content: string | undefined; lineNum: number }> => {
      const key = `${oldStr.length}-${newStr.length}-${oldStr.slice(0, 50)}`;
      if (cache.has(key)) {
        return cache.get(key)!;
      }

      const result = calculateDiff(oldStr, newStr);
      cache.set(key, result);
      if (cache.size > 100) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) {
          cache.delete(firstKey);
        }
      }
      return result;
    };
  }, []);

  // Load session messages from API with pagination
  const loadSessionMessages = useCallback(
    async (projectName: string, sessionId: string, loadMore = false): Promise<SessionMessage[]> => {
      if (!projectName || !sessionId) return [];

      const isInitialLoad = !loadMore;
      if (isInitialLoad) {
        setIsLoadingSessionMessages(true);
      } else {
        setIsLoadingMoreMessages(true);
      }

      try {
        const currentOffset = loadMore ? messagesOffset : 0;
        const response = await api.sessionMessages(
          projectName,
          sessionId,
          MESSAGES_PER_PAGE,
          currentOffset,
        );
        if (!response.ok) {
          throw new Error('Failed to load session messages');
        }
        const data = await response.json();

        // Handle paginated response
        if (data.hasMore !== undefined) {
          setHasMoreMessages(data.hasMore);
          setTotalMessages(data.total);
          setMessagesOffset(currentOffset + (data.messages?.length || 0));
          return data.messages || [];
        } else {
          // Backward compatibility for non-paginated response
          const messages = data.messages || [];
          setHasMoreMessages(false);
          setTotalMessages(messages.length);
          return messages;
        }
      } catch (error) {
        console.error('Error loading session messages:', error);
        return [];
      } finally {
        if (isInitialLoad) {
          setIsLoadingSessionMessages(false);
        } else {
          setIsLoadingMoreMessages(false);
        }
      }
    },
    [messagesOffset],
  );

  // Actual diff calculation function
  const calculateDiff = (
    oldStr: string,
    newStr: string,
  ): Array<{ type: string; content: string | undefined; lineNum: number }> => {
    const oldLines = oldStr.split('\n');
    const newLines = newStr.split('\n');

    // Simple diff algorithm - find common lines and differences
    const diffLines: Array<{ type: string; content: string | undefined; lineNum: number }> = [];
    let oldIndex = 0;
    let newIndex = 0;

    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      const oldLine = oldLines[oldIndex];
      const newLine = newLines[newIndex];

      if (oldIndex >= oldLines.length) {
        // Only new lines remaining
        diffLines.push({ type: 'added', content: newLine, lineNum: newIndex + 1 });
        newIndex++;
      } else if (newIndex >= newLines.length) {
        // Only old lines remaining
        diffLines.push({ type: 'removed', content: oldLine, lineNum: oldIndex + 1 });
        oldIndex++;
      } else if (oldLine === newLine) {
        // Lines are the same - skip in diff view (or show as context)
        oldIndex++;
        newIndex++;
      } else {
        // Lines are different
        diffLines.push({ type: 'removed', content: oldLine, lineNum: oldIndex + 1 });
        diffLines.push({ type: 'added', content: newLine, lineNum: newIndex + 1 });
        oldIndex++;
        newIndex++;
      }
    }

    return diffLines;
  };

  const convertSessionMessages = (rawMessages: SessionMessage[]): ChatMessage[] => {
    const converted = [];
    const toolResults = new Map(); // Map tool_use_id to tool result

    // First pass: collect all tool results
    for (const msg of rawMessages) {
      if (msg.message?.role === 'user' && Array.isArray(msg.message?.content)) {
        for (const part of msg.message.content) {
          if (part.type === 'tool_result') {
            toolResults.set(part.tool_use_id, {
              content: part.content,
              isError: part.is_error,
              timestamp: new Date(msg.timestamp || Date.now()),
            });
          }
        }
      }
    }

    // Second pass: process messages and attach tool results to tool uses
    // const toolUseMessages = new Map(); // Track tool use messages by ID
    for (const msg of rawMessages) {
      // Check if this is a hook feedback message
      const isHookFeedback =
        msg.message?.role === 'user' &&
        typeof msg.message?.content === 'string' &&
        msg.message.content.includes('operation feedback:');

      // Handle user messages
      if (msg.message?.role === 'user' && msg.message?.content) {
        let content = '';
        let messageType = 'user';

        if (Array.isArray(msg.message.content)) {
          // Handle array content, separating text and tool results
          const textParts = [];
          const toolResultParts = [];

          for (const part of msg.message.content) {
            if (part.type === 'text') {
              textParts.push(part.text);
            } else if (part.type === 'tool_result') {
              // Collect tool results to create separate messages
              toolResultParts.push(part);
            }
          }

          // First, add any text content as a user message
          content = textParts.join('\n');
        } else if (typeof msg.message.content === 'string') {
          // Check if this is a JSON string containing tool results
          if (
            msg.message.content.trim().startsWith('[{') &&
            msg.message.content.includes('"tool_use_id"') &&
            msg.message.content.includes('"type":"tool_result"')
          ) {
            try {
              const parsed = JSON.parse(msg.message.content);
              if (Array.isArray(parsed)) {
                // Process each tool result in the array
                for (const toolResult of parsed) {
                  if (toolResult.type === 'tool_result') {
                    converted.push({
                      id: msg.message.id || msg.uuid,
                      type: 'tool_result',
                      content:
                        typeof toolResult.content === 'string'
                          ? toolResult.content
                          : JSON.stringify(toolResult.content),
                      timestamp: msg.timestamp || new Date().toISOString(),
                      isToolResult: true,
                      toolUseId: toolResult.tool_use_id,
                      isError:
                        toolResult.is_error ||
                        (typeof toolResult.content === 'string' &&
                          toolResult.content.includes('<tool_use_error>')) ||
                        false,
                    });
                  }
                }
                // Don't add this as a user message since we processed it as tool results
                content = '';
              } else {
                content = msg.message.content;
              }
            } catch {
              // Not valid JSON, treat as regular content
              content = msg.message.content;
            }
          } else {
            content = msg.message.content;
          }
        } else {
          content = String(msg.message.content);
        }

        // Skip command messages and empty content
        if (
          content &&
          !content.startsWith('<command-name>') &&
          !content.startsWith('[Request interrupted')
        ) {
          if (isHookFeedback) {
            // Convert hook feedback to a special assistant message
            converted.push({
              id: msg.message.id || msg.uuid,
              type: 'hook_feedback',
              content: content,
              timestamp: msg.timestamp || new Date().toISOString(),
              isHookFeedback: true,
            });
          } else {
            converted.push({
              id: msg.message.id || msg.uuid,
              type: messageType,
              content: content,
              timestamp: msg.timestamp || new Date().toISOString(),
            });
          }
        }

        // Add tool result messages if we collected any
        if (Array.isArray(msg.message.content)) {
          for (const part of msg.message.content) {
            if (part.type === 'tool_result') {
              converted.push({
                id: msg.message.id || msg.uuid,
                type: 'tool_result',
                content:
                  typeof part.content === 'string' ? part.content : JSON.stringify(part.content),
                timestamp: msg.timestamp || new Date().toISOString(),
                isToolResult: true,
                toolUseId: part.tool_use_id,
                isError:
                  part.is_error ||
                  (typeof part.content === 'string' && part.content.includes('<tool_use_error>')) ||
                  false,
              });
            }
          }
        }
      }

      // Handle assistant messages
      else if (msg.message?.role === 'assistant' && msg.message?.content) {
        if (Array.isArray(msg.message.content)) {
          for (const part of msg.message.content) {
            if (part.type === 'text') {
              converted.push({
                id: msg.message.id || msg.uuid,
                type: 'assistant',
                content: part.text,
                timestamp: msg.timestamp || new Date().toISOString(),
              });
            } else if (part.type === 'tool_use') {
              // Get the corresponding tool result
              const toolResult = toolResults.get(part.id);

              converted.push({
                id: msg.message.id || msg.uuid,
                type: 'assistant',
                content: '',
                timestamp: msg.timestamp || new Date().toISOString(),
                isToolUse: true,
                toolName: part.name,
                toolInput: JSON.stringify(part.input),
                toolResult: toolResult
                  ? typeof toolResult.content === 'string'
                    ? toolResult.content
                    : JSON.stringify(toolResult.content)
                  : null,
                toolError: toolResult?.isError || false,
                toolResultTimestamp: toolResult?.timestamp || new Date(),
              });
            }
          }
        } else if (typeof msg.message.content === 'string') {
          converted.push({
            id: msg.message.id || msg.uuid,
            type: 'assistant',
            content: msg.message.content,
            timestamp: msg.timestamp || new Date().toISOString(),
          });
        }
      }
    }

    return converted as ChatMessage[];
  };

  // Memoize expensive convertSessionMessages operation
  const convertedMessages = useMemo(() => {
    return convertSessionMessages(sessionMessages);
  }, [sessionMessages]);

  // Define scroll functions early to avoid hoisting issues in useEffect dependencies
  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      setIsUserScrolledUp(false);
    }
  }, []);

  // Check if user is near the bottom of the scroll container
  const isNearBottom = useCallback(() => {
    if (!scrollContainerRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // Consider "near bottom" if within 50px of the bottom
    return scrollHeight - scrollTop - clientHeight < 50;
  }, []);

  // Handle scroll events to detect when user manually scrolls up and load more messages
  const handleScroll = useCallback(async () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const nearBottom = isNearBottom();
      setIsUserScrolledUp(!nearBottom);

      // Check if we should load more messages (scrolled near top)
      const scrolledNearTop = container.scrollTop < 100;
      const provider = localStorage.getItem('selected-provider') || 'claude';

      if (
        scrolledNearTop &&
        hasMoreMessages &&
        !isLoadingMoreMessages &&
        selectedSession &&
        selectedProject &&
        provider !== 'cursor'
      ) {
        // Save current scroll position
        const previousScrollHeight = container.scrollHeight;
        const previousScrollTop = container.scrollTop;

        // Load more messages
        const moreMessages = await loadSessionMessages(
          selectedProject.name,
          selectedSession.id,
          true,
        );

        if (moreMessages.length > 0) {
          // Prepend new messages to the existing ones
          setSessionMessages((prev) => [...moreMessages, ...prev]);

          // Restore scroll position after DOM update
          setTimeout(() => {
            if (scrollContainerRef.current) {
              const newScrollHeight = scrollContainerRef.current.scrollHeight;
              const scrollDiff = newScrollHeight - previousScrollHeight;
              scrollContainerRef.current.scrollTop = previousScrollTop + scrollDiff;
            }
          }, 0);
        }
      }
    }
  }, [
    isNearBottom,
    hasMoreMessages,
    isLoadingMoreMessages,
    selectedSession,
    selectedProject,
    loadSessionMessages,
  ]);

  useEffect(() => {
    // Load session messages when session changes
    const loadMessages = async () => {
      if (selectedSession && selectedProject) {
        const provider = 'claude';

        // Reset pagination state when switching sessions
        setMessagesOffset(0);
        setHasMoreMessages(false);
        setTotalMessages(0);

        if (provider === 'claude') {
          // For Claude, load messages normally with pagination
          setCurrentSessionId(selectedSession.id);

          // Only load messages from API if this is a user-initiated session change
          // For system-initiated changes, preserve existing messages and rely on WebSocket
          if (!isSystemSessionChange) {
            const messages = await loadSessionMessages(
              selectedProject.name,
              selectedSession.id,
              false,
            );
            setSessionMessages(messages);
            // convertedMessages will be automatically updated via useMemo
            // Scroll to bottom after loading session messages if auto-scroll is enabled
            if (autoScrollToBottom) {
              setTimeout(() => scrollToBottom(), 200);
            }
          } else {
            // Reset the flag after handling system session change
            setIsSystemSessionChange(false);
          }
        }
      } else {
        // Only clear messages if this is NOT a system-initiated session change AND we're not loading
        // During system session changes or while loading, preserve the chat messages
        if (!isSystemSessionChange && !isLoading) {
          setChatMessages([]);
          setSessionMessages([]);
        }
        setCurrentSessionId(null);
        setMessagesOffset(0);
        setHasMoreMessages(false);
        setTotalMessages(0);
      }
    };

    void loadMessages();
  }, [selectedSession, selectedProject, scrollToBottom, isSystemSessionChange]);

  // // Initialize sessionMessages from messages prop when no session is selected (demo mode)
  // useEffect(() => {
  //   if (!selectedSession && messages && messages.length > 0) {
  //     // Convert WebSocketMessage[] to SessionMessage[] for demo mode
  //     const convertedMessages: SessionMessage[] = messages.map((msg) => ({
  //       sessionId: msg.sessionId || 'demo',
  //       type: 'assistant' as const,
  //       message: {
  //         role: 'assistant',
  //         content: typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data),
  //       },
  //       timestamp: new Date().toISOString(),
  //     }));
  //     setSessionMessages(convertedMessages);
  //   }
  // }, [messages, selectedSession]);

  // Update chatMessages when convertedMessages changes
  useEffect(() => {
    if (sessionMessages.length > 0) {
      setChatMessages(convertedMessages);
    }
  }, [convertedMessages, sessionMessages]);

  // Notify parent when input focus changes
  useEffect(() => {
    if (onInputFocusChange) {
      onInputFocusChange(isInputFocused);
    }
  }, [isInputFocused, onInputFocusChange]);

  // Persist input draft to localStorage
  useEffect(() => {
    if (selectedProject && input !== '') {
      safeLocalStorage.setItem(`draft_input_${selectedProject.name}`, input);
    } else if (selectedProject && input === '') {
      safeLocalStorage.removeItem(`draft_input_${selectedProject.name}`);
    }
  }, [input, selectedProject]);

  // Persist chat messages to localStorage
  useEffect(() => {
    if (selectedProject && chatMessages.length > 0) {
      safeLocalStorage.setItem(
        `chat_messages_${selectedProject.name}`,
        JSON.stringify(chatMessages),
      );
    }
  }, [chatMessages, selectedProject]);

  // Load saved state when project changes (but don't interfere with session loading)
  useEffect(() => {
    if (selectedProject) {
      // Always load saved input draft for the project
      const savedInput = safeLocalStorage.getItem(`draft_input_${selectedProject.name}`) || '';
      if (savedInput !== input) {
        setInput(savedInput);
      }
    }
  }, [selectedProject?.name]);

  useEffect(() => {
    // Handle WebSocket messages
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      if (!latestMessage) return;

      switch (latestMessage.type) {
        case 'session-created':
          // New session created by Claude CLI - we receive the real session ID here
          // Store it temporarily until conversation completes (prevents premature session association)
          if (latestMessage.sessionId && !currentSessionId) {
            sessionStorage.setItem('pendingSessionId', latestMessage.sessionId);

            // Session Protection: Replace temporary "new-session-*" identifier with real session ID
            // This maintains protection continuity - no gap between temp ID and real ID
            // The temporary session is removed and real session is marked as active
            if (onReplaceTemporarySession) {
              onReplaceTemporarySession(latestMessage.sessionId);
            }
          }
          break;

        case 'claude-response': {
          // The data can be either a Message directly or a ClaudeResponseData wrapper
          const rawData = latestMessage.data;

          // If we don't have a session ID yet and the message contains one, set it
          if (!currentSessionId && rawData && typeof rawData === 'object' && 'session_id' in rawData && rawData.session_id) {
            console.log(`setting session id to ${rawData.session_id}`)
            setCurrentSessionId(rawData.session_id as string);
          }

          // Check if this is a streaming message (has delta or is content_block_stop)
          if (
            rawData &&
            typeof rawData === 'object' &&
            'type' in rawData &&
            ((rawData as StreamingMessageData).type === 'content_block_delta' ||
              (rawData as StreamingMessageData).type === 'content_block_stop')
          ) {
            const responseData = rawData as ClaudeResponseData;
            if (responseData.type === 'content_block_delta' && responseData.delta?.text) {
              // Buffer deltas and flush periodically to reduce rerenders
              streamBufferRef.current += responseData.delta.text;
              if (!streamTimerRef.current) {
                streamTimerRef.current = setTimeout(() => {
                  const chunk = streamBufferRef.current;
                  streamBufferRef.current = '';
                  streamTimerRef.current = null;
                  if (!chunk) return;
                  setChatMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.type === 'assistant' && !last.isToolUse && last.isStreaming) {
                      last.content = (last.content || '') + chunk;
                    } else {
                      updated.push({
                        type: 'assistant',
                        content: chunk,
                        timestamp: new Date().toISOString(),
                        isStreaming: true,
                        sessionId: currentSessionId || 'temp',
                      } as ChatMessage);
                    }
                    return updated;
                  });
                }, 100);
              }
              return;
            }
            if (responseData.type === 'content_block_stop') {
              // Flush any buffered text and mark streaming message complete
              if (streamTimerRef.current) {
                clearTimeout(streamTimerRef.current);
                streamTimerRef.current = null;
              }
              const chunk = streamBufferRef.current;
              streamBufferRef.current = '';
              if (chunk) {
                setChatMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.type === 'assistant' && !last.isToolUse && last.isStreaming) {
                    last.content = (last.content || '') + chunk;
                  } else {
                    updated.push({
                      type: 'assistant',
                      content: chunk,
                      timestamp: new Date().toISOString(),
                      isStreaming: true,
                      sessionId: currentSessionId || 'temp',
                    });
                  }
                  return updated;
                });
              }
              setChatMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.type === 'assistant' && last.isStreaming) {
                  last.isStreaming = false;
                }
                return updated;
              });
              return;
            }
          }
          // Handle different types of content in the response
          // At this point, rawData should be a Message object
          const typedMessage = rawData as Message;

          // Debug log to see what we're processing
          if (typedMessage && typedMessage.type === 'assistant') {
            // console.log('[ChatInterface] Processing assistant message:', typedMessage);
          }

          // Handle tool_result messages that come through claude-response
          if (typedMessage && typedMessage.type === 'tool_result') {
            const resultContent = (typedMessage as ToolResultMessage).content?.[0];

            if (resultContent?.tool_use_id) {
              // This is a tool result - add it as a separate message
              setChatMessages((prev) => [
                ...prev,
                {
                  type: 'tool_result' as const,
                  content: resultContent.content || '',
                  isError: resultContent.is_error || false,
                  toolUseId: resultContent.tool_use_id,
                  timestamp: new Date().toISOString(),
                  sessionId: currentSessionId || 'temp',
                },
              ]);
            } else if (resultContent?.type === 'text') {
              // This is hook feedback - add as a new message
              setChatMessages((prev) => [
                ...prev,
                {
                  type: 'hook_feedback' as const,
                  content: resultContent.text || '',
                  timestamp: new Date().toISOString(),
                  sessionId: currentSessionId || 'temp',
                },
              ]);
            }
            break; // Exit early since we handled the tool_result
          }

          if (
            typedMessage &&
            'content' in typedMessage &&
            Array.isArray((typedMessage as AssistantMessage).content)
          ) {
            for (const part of (typedMessage as AssistantMessage).content) {
              if (part.type === 'tool_use') {
                // Add tool use message
                const toolInput = part.input ? JSON.stringify(part.input, null, 2) : '';
                setChatMessages((prev) => [
                  ...prev,
                  {
                    type: 'assistant',
                    content: '',
                    timestamp: new Date().toISOString(),
                    isToolUse: true,
                    toolName: part.name,
                    toolInput: toolInput,
                    toolId: part.id,
                    toolResult: undefined, // Will be updated when result comes in
                    sessionId: currentSessionId || 'temp',
                  },
                ]);
              } else if (part.type === 'text' && part.text?.trim()) {
                // Normalize usage limit message to local time
                let content = formatUsageLimitText(part.text);

                // Add regular text message
                setChatMessages((prev) => [
                  ...prev,
                  {
                    type: 'assistant',
                    content: String(content),
                    timestamp: new Date().toISOString(),
                    sessionId: currentSessionId || 'temp',
                  },
                ]);
              }
            }
          } else if (
            typedMessage &&
            'content' in typedMessage &&
            typeof typedMessage.content === 'string' &&
            typedMessage.content.trim()
          ) {
            // Normalize usage limit message to local time
            let content = formatUsageLimitText(typedMessage.content);

            // Add regular text message
            setChatMessages((prev) => [
              ...prev,
              {
                type: 'assistant',
                content: String(content),
                timestamp: new Date().toISOString(),
                sessionId: currentSessionId || 'temp',
              },
            ]);
          }

          // Handle tool results from user messages (these come separately)
          if (
            typedMessage &&
            'role' in typedMessage &&
            typedMessage.role === 'user' &&
            Array.isArray((typedMessage as UserMessageWithToolResults).content)
          ) {
            for (const part of (typedMessage as UserMessageWithToolResults).content) {
              if (part.type === 'tool_result') {
                // Find the corresponding tool use and update it with the result
                setChatMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.isToolUse && msg.toolId === part.tool_use_id) {
                      return {
                        ...msg,
                        toolResult: {
                          content: part.content,
                          isError: part.is_error || false,
                          timestamp: new Date().toISOString(),
                        },
                      };
                    }
                    return msg;
                  }),
                );
              }
            }
          }
          break;
        }

        case 'claude-output':
          {
            const cleaned = String(
              (latestMessage.data as unknown as {
                type?: string;
                delta?: { text: string };
                content?: string;
              }) || '',
            );
            if (cleaned.trim()) {
              streamBufferRef.current += streamBufferRef.current ? `\n${cleaned}` : cleaned;
              if (!streamTimerRef.current) {
                streamTimerRef.current = setTimeout(() => {
                  const chunk = streamBufferRef.current;
                  streamBufferRef.current = '';
                  streamTimerRef.current = null;
                  if (!chunk) return;
                  setChatMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.type === 'assistant' && !last.isToolUse && last.isStreaming) {
                      last.content = last.content ? `${last.content}\n${chunk}` : chunk;
                    } else {
                      updated.push({
                        type: 'assistant',
                        content: chunk,
                        timestamp: new Date().toISOString(),
                        isStreaming: true,
                        sessionId: currentSessionId || 'temp',
                      } as ChatMessage);
                    }
                    return updated;
                  });
                }, 100);
              }
            }
          }
          break;
        case 'claude-interactive-prompt':
          // Handle interactive prompts from CLI
          setChatMessages((prev) => [
            ...prev,
            {
              type: 'assistant',
              content: latestMessage.data as unknown as string,
              timestamp: new Date().toISOString(),
              isInteractivePrompt: true,
              sessionId: currentSessionId || 'temp',
            },
          ]);
          break;

        case 'claude-error':
          setChatMessages((prev) => [
            ...prev,
            {
              type: 'error',
              content: `Error: ${latestMessage.error}`,
              timestamp: new Date().toISOString(),
              sessionId: currentSessionId || 'temp',
            },
          ]);
          break;

        case 'claude-complete': {
          setIsLoading(false);
          setCanAbortSession(false);
          setClaudeStatus(null);

          // Session Protection: Mark session as inactive to re-enable automatic project updates
          // Conversation is complete, safe to allow project updates again
          // Use real session ID if available, otherwise use pending session ID
          const activeSessionId = currentSessionId || sessionStorage.getItem('pendingSessionId');
          if (activeSessionId && onSessionInactive) {
            onSessionInactive();
          }

          // If we have a pending session ID and the conversation completed successfully, use it
          const pendingSessionId = sessionStorage.getItem('pendingSessionId');
          if (pendingSessionId && !currentSessionId && latestMessage.exitCode === 0) {
            setCurrentSessionId(pendingSessionId);
            sessionStorage.removeItem('pendingSessionId');

            // Trigger a project refresh to update the sidebar with the new session
            if (window.refreshProjects) {
              setTimeout(() => window.refreshProjects?.(), 500);
            }
          }

          // Clear persisted chat messages after successful completion
          if (selectedProject && latestMessage.exitCode === 0) {
            safeLocalStorage.removeItem(`chat_messages_${selectedProject.name}`);
          }
          break;
        }

        case 'session-aborted':
          setIsLoading(false);
          setCanAbortSession(false);
          setClaudeStatus(null);

          // Session Protection: Mark session as inactive when aborted
          // User or system aborted the conversation, re-enable project updates
          if (currentSessionId && onSessionInactive) {
            onSessionInactive();
          }

          setChatMessages((prev) => [
            ...prev,
            {
              type: 'assistant',
              content: 'Session interrupted by user.',
              timestamp: new Date().toISOString(),
              sessionId: currentSessionId || 'temp',
            },
          ]);
          break;

        case 'claude-status': {
          // Handle Claude working status messages
          const statusData = latestMessage.data as unknown as ClaudeStatusData;
          if (statusData) {
            // Parse the status message to extract relevant information
            let statusInfo = {
              text: 'Working...',
              tokens: 0,
              can_interrupt: true,
            };

            // Check for different status message formats
            if (statusData.message) {
              statusInfo.text = statusData.message;
            } else if (statusData.status) {
              statusInfo.text = statusData.status;
            } else if (typeof statusData === 'string') {
              statusInfo.text = statusData;
            }

            // Extract token count
            if (statusData.tokens) {
              statusInfo.tokens = statusData.tokens;
            } else if (statusData.token_count) {
              statusInfo.tokens = statusData.token_count;
            }

            // Check if can interrupt
            if (statusData.can_interrupt !== undefined) {
              statusInfo.can_interrupt = statusData.can_interrupt;
            }

            setClaudeStatus(statusInfo);
            setIsLoading(true);
            setCanAbortSession(statusInfo.can_interrupt);
          }
          break;
        }
      }
    }
  }, [messages]);

  // Load file list when project changes
  useEffect(() => {
    if (selectedProject) {
      void fetchProjectFiles();
    }
  }, [selectedProject]);

  const fetchProjectFiles = async () => {
    if (!selectedProject) return;
    try {
      const response = await api.getFiles(selectedProject.name);
      if (response.ok) {
        const files = await response.json();
        // Flatten the file tree to get all file paths
        const flatFiles = flattenFileTree(files);
        setFileList(flatFiles);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  const flattenFileTree = (files: FileTreeNode[], basePath = ''): FileTreeNode[] => {
    let result: FileTreeNode[] = [];
    for (const file of files) {
      const fullPath = basePath ? `${basePath}/${file.name}` : file.name;
      if (file.type === 'directory' && file.children) {
        result = result.concat(flattenFileTree(file.children, fullPath));
      } else if (file.type === 'file') {
        result.push({
          name: file.name,
          path: fullPath,
          type: 'file' as const,
        });
      }
    }
    return result;
  };

  // Handle @ symbol detection and file filtering
  useEffect(() => {
    const textBeforeCursor = input.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Check if there's a space after the @ symbol (which would end the file reference)
      if (!textAfterAt.includes(' ')) {
        setAtSymbolPosition(lastAtIndex);
        setShowFileDropdown(true);

        // Filter files based on the text after @
        const filtered = fileList
          .filter(
            (file) =>
              file.name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
              file.path.toLowerCase().includes(textAfterAt.toLowerCase()),
          )
          .slice(0, 10); // Limit to 10 results

        setFilteredFiles(filtered);
        setSelectedFileIndex(-1);
      } else {
        setShowFileDropdown(false);
        setAtSymbolPosition(-1);
      }
    } else {
      setShowFileDropdown(false);
      setAtSymbolPosition(-1);
    }
  }, [input, cursorPosition, fileList]);

  // Debounced input handling
  useEffect(() => {
    const timer = setTimeout(() => {
      // setDebouncedInput(input);
    }, 150); // 150ms debounce

    return () => clearTimeout(timer);
  }, [input]);

  // Show only recent messages for better performance
  const visibleMessages = useMemo(() => {
    if (chatMessages.length <= visibleMessageCount) {
      return chatMessages;
    }
    return chatMessages.slice(-visibleMessageCount);
  }, [chatMessages, visibleMessageCount]);

  // Capture scroll position before render when auto-scroll is disabled
  useEffect(() => {
    if (!autoScrollToBottom && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      scrollPositionRef.current = {
        height: container.scrollHeight,
        top: container.scrollTop,
      };
    }
  });

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollContainerRef.current && chatMessages.length > 0) {
      if (autoScrollToBottom) {
        // If auto-scroll is enabled, always scroll to bottom unless user has manually scrolled up
        if (!isUserScrolledUp) {
          setTimeout(() => scrollToBottom(), 50); // Small delay to ensure DOM is updated
        }
      } else {
        // When auto-scroll is disabled, preserve the visual position
        const container = scrollContainerRef.current;
        const prevHeight = scrollPositionRef.current.height;
        const prevTop = scrollPositionRef.current.top;
        const newHeight = container.scrollHeight;
        const heightDiff = newHeight - prevHeight;

        // If content was added above the current view, adjust scroll position
        if (heightDiff > 0 && prevTop > 0) {
          container.scrollTop = prevTop + heightDiff;
        }
      }
    }
  }, [chatMessages.length, isUserScrolledUp, scrollToBottom, autoScrollToBottom]);

  // Scroll to bottom when component mounts with existing messages or when messages first load
  useEffect(() => {
    if (scrollContainerRef.current && chatMessages.length > 0) {
      // Always scroll to bottom when messages first load (user expects to see latest)
      // Also reset scroll state
      setIsUserScrolledUp(false);
      setTimeout(() => scrollToBottom(), 200); // Longer delay to ensure full rendering
    }
  }, [chatMessages.length > 0, scrollToBottom]); // Trigger when messages first appear

  // Add scroll event listener to detect user scrolling
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
    return undefined;
  }, [handleScroll]);

  // Initial textarea setup
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';

      // Check if initially expanded
      const lineHeight = parseInt(window.getComputedStyle(textareaRef.current).lineHeight);
      const isExpanded = textareaRef.current.scrollHeight > lineHeight * 2;
      setIsTextareaExpanded(isExpanded);
    }
  }, []); // Only run once on mount

  // Reset textarea height when input is cleared programmatically
  useEffect(() => {
    if (textareaRef.current && !input.trim()) {
      textareaRef.current.style.height = 'auto';
      setIsTextareaExpanded(false);
    }
  }, [input]);

  // Load earlier messages by increasing the visible message count
  const loadEarlierMessages = useCallback(() => {
    setVisibleMessageCount((prevCount) => prevCount + 100);
  }, []);

  // Handle image files from drag & drop or file picker
  const handleImageFiles = useCallback((files: File[]) => {
    const validFiles = files.filter((file) => {
      try {
        // Validate file object and properties
        if (!file || typeof file !== 'object') {
          console.warn('Invalid file object:', file);
          return false;
        }

        if (!file.type || !file.type.startsWith('image/')) {
          return false;
        }

        if (!file.size || file.size > 5 * 1024 * 1024) {
          // Safely get file name with fallback
          const fileName = file.name || 'Unknown file';
          setImageErrors((prev) => {
            const newMap = new Map(prev);
            newMap.set(fileName, 'File too large (max 5MB)');
            return newMap;
          });
          return false;
        }

        return true;
      } catch (error) {
        console.error('Error validating file:', error, file);
        return false;
      }
    });

    if (validFiles.length > 0) {
      const uploadedImages: UploadedImage[] = validFiles.map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        url: URL.createObjectURL(file),
        file: file,
        status: 'uploaded' as const,
      }));
      setAttachedImages((prev) => [...prev, ...uploadedImages].slice(0, 5)); // Max 5 images
    }
  }, []);

  // Handle clipboard paste for images
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = Array.from(e.clipboardData.items);

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            handleImageFiles([file]);
          }
        }
      }

      // Fallback for some browsers/platforms
      if (items.length === 0 && e.clipboardData.files.length > 0) {
        const files = Array.from(e.clipboardData.files);
        const imageFiles = files.filter((f) => f.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          handleImageFiles(imageFiles);
        }
      }
    },
    [handleImageFiles],
  );

  // Setup dropzone
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 5,
    onDrop: handleImageFiles,
    noClick: true, // We'll use our own button
    noKeyboard: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !selectedProject) return;

    // Upload images first if any
    let uploadedImages = [];
    if (attachedImages.length > 0) {
      const formData = new FormData();
      attachedImages.forEach((image) => {
        formData.append('images', image.file);
      });

      try {
        const token = safeLocalStorage.getItem('auth-token');
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`/api/projects/${selectedProject.name}/upload-images`, {
          method: 'POST',
          headers: headers,
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Failed to upload images');
        }

        const result = await response.json();
        uploadedImages = result.images;
      } catch (error) {
        console.error('Image upload failed:', error);
        setChatMessages((prev) => [
          ...prev,
          {
            type: 'error',
            content: `Failed to upload images: ${(error as Error).message || 'Unknown error'}`,
            timestamp: new Date().toISOString(),
            sessionId: currentSessionId || 'temp',
          },
        ]);
        return;
      }
    }

    const userMessage = {
      type: 'user' as const,
      content: input,
      images: uploadedImages,
      timestamp: new Date().toISOString(),
      sessionId: currentSessionId || 'temp',
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setCanAbortSession(true);
    // Set a default status when starting
    setClaudeStatus({
      text: 'Processing',
      tokens: 0,
      can_interrupt: true,
    });

    // Always scroll to bottom when user sends a message and reset scroll state
    setIsUserScrolledUp(false); // Reset scroll state so auto-scroll works for Claude's response
    setTimeout(() => scrollToBottom(), 100); // Longer delay to ensure message is rendered

    // Determine effective session id for replies to avoid race on state updates
    const effectiveSessionId = selectedSession?.id;

    // Session Protection: Mark session as active to prevent automatic project updates during conversation
    // Use existing session if available; otherwise a temporary placeholder until backend provides real ID
    const sessionToActivate = effectiveSessionId || `new-session-${Date.now()}`;
    if (onSessionActive) {
      onSessionActive?.(sessionToActivate);
    }

    // Get tools settings from localStorage based on provider
    const getToolsSettings = () => {
      try {
        const settingsKey = 'claude-tools-settings';
        const savedSettings = safeLocalStorage.getItem(settingsKey);
        if (savedSettings) {
          return JSON.parse(savedSettings);
        }
      } catch (error) {
        console.error('Error loading tools settings:', error);
      }
      return {
        allowedTools: [],
        disallowedTools: [],
        skipPermissions: false,
      };
    };

    const toolsSettings = getToolsSettings();

    // Send command based on provider
    if (provider === 'claude') {
      // Send Claude command (existing code)
      sendMessage({
        type: 'claude-command',
        command: input,
        options: {
          projectPath: selectedProject.path,
          cwd: selectedProject.fullPath,
          sessionId: currentSessionId || undefined,
          resume: !!currentSessionId,
          toolsSettings: toolsSettings,
          permissionMode: permissionMode as 'default' | 'acceptEdits' | 'bypassPermissions',
          images: uploadedImages, // Pass images to backend
        },
      });
    }

    setInput('');
    setAttachedImages([]);
    setUploadingImages(new Map());
    setImageErrors(new Map());
    setIsTextareaExpanded(false);

    // Reset textarea height

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Clear the saved draft since message was sent
    if (selectedProject) {
      safeLocalStorage.removeItem(`draft_input_${selectedProject.name}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle file dropdown navigation
    if (showFileDropdown && filteredFiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedFileIndex((prev) => (prev < filteredFiles.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedFileIndex((prev) => (prev > 0 ? prev - 1 : filteredFiles.length - 1));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        if (selectedFileIndex >= 0 && filteredFiles[selectedFileIndex]) {
          selectFile(filteredFiles[selectedFileIndex]);
        } else if (filteredFiles.length > 0 && filteredFiles[0]) {
          selectFile(filteredFiles[0]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowFileDropdown(false);
        return;
      }
    }

    // Handle Tab key for mode switching (only when file dropdown is not showing)
    if (e.key === 'Tab' && !showFileDropdown) {
      e.preventDefault();
      const modes = ['default', 'acceptEdits', 'bypassPermissions', 'plan'];
      const currentIndex = modes.indexOf(permissionMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      setPermissionMode(modes[nextIndex] || 'default');
      return;
    }

    // Handle Enter key: Ctrl+Enter (Cmd+Enter on Mac) sends, Shift+Enter creates new line
    if (e.key === 'Enter') {
      // If we're in composition, don't send message
      if (e.nativeEvent.isComposing) {
        return; // Let IME handle the Enter key
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        // Ctrl+Enter or Cmd+Enter: Send message
        e.preventDefault();
        void handleSubmit(e);
      } else if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        // Plain Enter: Send message only if not in IME composition
        if (!sendByCtrlEnter) {
          e.preventDefault();
          void handleSubmit(e);
        }
      }
      // Shift+Enter: Allow default behavior (new line)
    }
  };

  const selectFile = (file: FileTreeNode) => {
    const textBeforeAt = input.slice(0, atSymbolPosition);
    const textAfterAtQuery = input.slice(atSymbolPosition);
    const spaceIndex = textAfterAtQuery.indexOf(' ');
    const textAfterQuery = spaceIndex !== -1 ? textAfterAtQuery.slice(spaceIndex) : '';

    const newInput = textBeforeAt + '@' + file.path + ' ' + textAfterQuery;
    const newCursorPos = textBeforeAt.length + 1 + file.path.length + 1;

    // Immediately ensure focus is maintained
    if (textareaRef.current && !textareaRef.current.matches(':focus')) {
      textareaRef.current.focus();
    }

    // Update input and cursor position
    setInput(newInput);
    setCursorPosition(newCursorPos);

    // Hide dropdown
    setShowFileDropdown(false);
    setAtSymbolPosition(-1);

    // Set cursor position synchronously
    if (textareaRef.current) {
      // Use requestAnimationFrame for smoother updates
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          // Ensure focus is maintained
          if (!textareaRef.current.matches(':focus')) {
            textareaRef.current.focus();
          }
        }
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInput(newValue);
    setCursorPosition(e.target.selectionStart);

    // Handle height reset when input becomes empty
    if (!newValue.trim()) {
      e.target.style.height = 'auto';
      setIsTextareaExpanded(false);
    }
  };

  const handleTextareaClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    setCursorPosition((e.target as HTMLTextAreaElement).selectionStart);
  };

  // const handleNewSession = () => {
  //   setChatMessages([]);
  //   setInput('');
  //   setIsLoading(false);
  //   setCanAbortSession(false);
  // };

  const handleAbortSession = () => {
    if (currentSessionId && canAbortSession) {
      sendMessage({
        type: 'abort-session',
        sessionId: currentSessionId,
        provider: provider,
      });
    }
  };

  const handleModeSwitch = () => {
    const modes = ['default', 'acceptEdits', 'bypassPermissions', 'plan'];
    const currentIndex = modes.indexOf(permissionMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setPermissionMode(modes[nextIndex] || 'default');
  };

  // Don't render if no project is selected
  if (!selectedProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p>Select a project to start chatting with Claude</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>
        {`
          details[open] .details-chevron {
            transform: rotate(180deg);
          }
        `}
      </style>
      <div className="h-full flex flex-col">
        {/* Messages Area - Scrollable Middle Section */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-0 py-3 sm:p-4 space-y-3 sm:space-y-4 relative"
        >
          {isLoadingSessionMessages && chatMessages.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                <p>Loading session messages...</p>
              </div>
            </div>
          ) : chatMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              {!selectedSession && !currentSessionId && (
                <div className="text-center px-6 sm:px-4 py-8">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    Choose Your AI Assistant
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-8">
                    Select a provider to start a new conversation
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
                    {/* Claude Button */}
                    <button
                      onClick={() => {
                        setProvider('claude');
                        localStorage.setItem('selected-provider', 'claude');
                        // Focus input after selection
                        setTimeout(() => textareaRef.current?.focus(), 100);
                      }}
                      className={`group relative w-64 h-32 bg-white dark:bg-gray-800 rounded-xl border-2 transition-all duration-200 hover:scale-105 hover:shadow-xl ${
                        provider === 'claude'
                          ? 'border-blue-500 shadow-lg ring-2 ring-blue-500/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center h-full gap-3">
                        <ClaudeLogo className="w-10 h-10" />
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">Claude</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">by Anthropic</p>
                        </div>
                      </div>
                      {provider === 'claude' && (
                        <div className="absolute top-2 right-2">
                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Model Selection Claude - Always reserve space to prevent jumping */}
                  <div
                    className={`mb-6 transition-opacity duration-200 ${provider === 'claude' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                  >
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {provider === 'claude' ? 'Select Model' : '\u00A0'}
                    </label>
                    <select
                      value={claudeModel}
                      onChange={(e) => {
                        const newModel = e.target.value;
                        setClaudeModel(newModel);
                        localStorage.setItem('claude-model', newModel);
                      }}
                      className="pl-4 pr-10 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 min-w-[140px]"
                      disabled={provider !== 'claude'}
                    >
                      {claudeCodeModels.map(({ name, alias }) => (
                        <option key={alias} value={alias}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {provider === 'claude'
                      ? 'Ready to use Claude AI. Start typing your message below.'
                      : 'Select a provider above to begin'}
                  </p>
                </div>
              )}
              {selectedSession && (
                <div className="text-center text-gray-500 dark:text-gray-400 px-6 sm:px-4">
                  <p className="font-bold text-lg sm:text-xl mb-3">Continue your conversation</p>
                  <p className="text-sm sm:text-base leading-relaxed">
                    Ask questions about your code, request changes, or get help with development
                    tasks
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Loading indicator for older messages */}
              {isLoadingMoreMessages && (
                <div className="text-center text-gray-500 dark:text-gray-400 py-3">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                    <p className="text-sm">Loading older messages...</p>
                  </div>
                </div>
              )}

              {/* Indicator showing there are more messages to load */}
              {hasMoreMessages && !isLoadingMoreMessages && (
                <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-2 border-b border-gray-200 dark:border-gray-700">
                  {totalMessages > 0 && (
                    <span>
                      Showing {sessionMessages.length} of {totalMessages} messages •
                      <span className="text-xs">Scroll up to load more</span>
                    </span>
                  )}
                </div>
              )}

              {/* Legacy message count indicator (for non-paginated view) */}
              {!hasMoreMessages && chatMessages.length > visibleMessageCount && (
                <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-2 border-b border-gray-200 dark:border-gray-700">
                  Showing last {visibleMessageCount} messages ({chatMessages.length} total) •
                  <button
                    className="ml-1 text-blue-600 hover:text-blue-700 underline"
                    onClick={loadEarlierMessages}
                  >
                    Load earlier messages
                  </button>
                </div>
              )}

              {visibleMessages.map((message, index) => {
                const prevMessage = index > 0 ? visibleMessages[index - 1] : undefined;

                const nextMessage = visibleMessages[index + 1];

                return (
                  <MessageComponent
                    key={index}
                    message={message}
                    prevMessage={prevMessage}
                    nextMessage={nextMessage}
                    createDiff={createDiff}
                    onFileOpen={onFileOpen}
                    onShowSettings={onShowSettings}
                    autoExpandTools={autoExpandTools}
                    showRawParameters={showRawParameters}
                  />
                );
              })}
            </>
          )}

          {isLoading && (
            <div className="chat-message assistant">
              <div className="w-full">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0 p-1 bg-transparent">
                    <ClaudeLogo className="w-full h-full" />
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    'Claude'
                  </div>
                  {/* Abort button removed - functionality not yet implemented at backend */}
                </div>
                <div className="w-full text-sm text-gray-500 dark:text-gray-400 pl-3 sm:pl-0">
                  <div className="flex items-center space-x-1">
                    <div className="animate-pulse">●</div>
                    <div className="animate-pulse" style={{ animationDelay: '0.2s' }}>
                      ●
                    </div>
                    <div className="animate-pulse" style={{ animationDelay: '0.4s' }}>
                      ●
                    </div>
                    <span className="ml-2">Thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area - Fixed Bottom */}
        <div
          className={`p-2 sm:p-4 md:p-4 flex-shrink-0 ${
            isInputFocused ? 'pb-2 sm:pb-4 md:pb-6' : 'pb-16 sm:pb-4 md:pb-6'
          }`}
        >
          <div className="flex-1">
            <ClaudeStatus
              status={claudeStatus || {}}
              isLoading={isLoading}
              onAbort={handleAbortSession}
              provider={provider}
            />
          </div>
          {/* Permission Mode Selector with scroll to bottom button - Above input, clickable for mobile */}
          <div className="max-w-4xl mx-auto mb-3">
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleModeSwitch}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
                  permissionMode === 'default'
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                    : permissionMode === 'acceptEdits'
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-300 dark:border-green-600 hover:bg-green-100 dark:hover:bg-green-900/30'
                      : permissionMode === 'bypassPermissions'
                        ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                        : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                }`}
                title="Click to change permission mode (or press Tab in input)"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      permissionMode === 'default'
                        ? 'bg-gray-500'
                        : permissionMode === 'acceptEdits'
                          ? 'bg-green-500'
                          : permissionMode === 'bypassPermissions'
                            ? 'bg-orange-500'
                            : 'bg-blue-500'
                    }`}
                  />
                  <span>
                    {permissionMode === 'default' && 'Default Mode'}
                    {permissionMode === 'acceptEdits' && 'Accept Edits'}
                    {permissionMode === 'bypassPermissions' && 'Bypass Permissions'}
                    {permissionMode === 'plan' && 'Plan Mode'}
                  </span>
                </div>
              </button>

              {/* Scroll to bottom button - positioned next to mode indicator */}
              {isUserScrolledUp && chatMessages.length > 0 && (
                <button
                  onClick={scrollToBottom}
                  className="w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:ring-offset-gray-800"
                  title="Scroll to bottom"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
            {/* Drag overlay */}
            {isDragActive && (
              <div className="absolute inset-0 bg-blue-500/20 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg">
                  <svg
                    className="w-8 h-8 text-blue-500 mx-auto mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-sm font-medium">Drop images here</p>
                </div>
              </div>
            )}

            {/* Image attachments preview */}
            {attachedImages.length > 0 && (
              <div className="mb-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex flex-wrap gap-2">
                  {attachedImages.map((file, index) => (
                    <ImageAttachment
                      key={index}
                      file={file.file}
                      onRemove={() => {
                        setAttachedImages((prev) => prev.filter((_, i) => i !== index));
                      }}
                      uploadProgress={uploadingImages.get(file.file.name)}
                      error={imageErrors.get(file.file.name)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* File dropdown - positioned outside dropzone to avoid conflicts */}
            {showFileDropdown && filteredFiles.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50 backdrop-blur-sm">
                {filteredFiles.map((file, index) => (
                  <div
                    key={file.path}
                    className={`px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0 touch-manipulation ${
                      index === selectedFileIndex
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                    onMouseDown={(e) => {
                      // Prevent textarea from losing focus on mobile
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      selectFile(file);
                    }}
                  >
                    <div className="font-medium text-sm">{file.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {file.path}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div
              {...getRootProps()}
              className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-600 focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-blue-500 focus-within:border-blue-500 transition-all duration-200 ${isTextareaExpanded ? 'chat-input-expanded' : ''}`}
            >
              <input {...getInputProps()} />
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onClick={handleTextareaClick}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                onInput={(e: React.FormEvent<HTMLTextAreaElement>) => {
                  // Immediate resize on input for better UX
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = target.scrollHeight + 'px';
                  setCursorPosition(target.selectionStart || 0);

                  // Check if textarea is expanded (more than 2 lines worth of height)
                  const lineHeight = parseInt(window.getComputedStyle(target).lineHeight);
                  const isExpanded = target.scrollHeight > lineHeight * 2;
                  setIsTextareaExpanded(isExpanded);
                }}
                placeholder="Ask Claude to help with your code... (@ to reference files)"
                disabled={isLoading}
                rows={1}
                className="chat-input-placeholder w-full pl-12 pr-28 sm:pr-40 py-3 sm:py-4 bg-transparent rounded-2xl focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 resize-none min-h-[40px] sm:min-h-[56px] max-h-[40vh] sm:max-h-[300px] overflow-y-auto text-sm sm:text-base transition-all duration-200"
                style={{ height: 'auto' }}
              />
              {/* Clear button - shown when there's text */}
              {input.trim() && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setInput('');
                    if (textareaRef.current) {
                      textareaRef.current.style.height = 'auto';
                      textareaRef.current.focus();
                    }
                    setIsTextareaExpanded(false);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setInput('');
                    if (textareaRef.current) {
                      textareaRef.current.style.height = 'auto';
                      textareaRef.current.focus();
                    }
                    setIsTextareaExpanded(false);
                  }}
                  className="absolute -left-0.5 -top-3 sm:right-28 sm:left-auto sm:top-1/2 sm:-translate-y-1/2 w-6 h-6 sm:w-8 sm:h-8 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center transition-all duration-200 group z-10 shadow-sm"
                  title="Clear input"
                >
                  <svg
                    className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-gray-100 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
              {/* Image upload button */}
              <button
                type="button"
                onClick={open}
                className="absolute left-2 bottom-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Attach images"
              >
                <svg
                  className="w-5 h-5 text-gray-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </button>

              {/* Send button */}
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                onMouseDown={async (e) => {
                  e.preventDefault();
                  await handleSubmit(e);
                }}
                onTouchStart={async (e) => {
                  e.preventDefault();
                  await handleSubmit(e);
                }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 w-12 h-12 sm:w-12 sm:h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:ring-offset-gray-800"
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-white transform rotate-90"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
            {/* Hint text */}
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2 hidden sm:block">
              {sendByCtrlEnter
                ? 'Ctrl+Enter to send (IME safe) • Shift+Enter for new line • Tab to change modes • @ to reference files'
                : 'Press Enter to send • Shift+Enter for new line • Tab to change modes • @ to reference files'}
            </div>
            <div
              className={`text-xs text-gray-500 dark:text-gray-400 text-center mt-2 sm:hidden transition-opacity duration-200 ${
                isInputFocused ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {sendByCtrlEnter
                ? 'Ctrl+Enter to send (IME safe) • Tab for modes • @ for files'
                : 'Enter to send • Tab for modes • @ for files'}
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default React.memo<ChatInterfaceProps>(ChatInterface);
