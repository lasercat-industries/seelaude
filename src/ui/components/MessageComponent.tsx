import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage, DiffInfo } from './types';
import ClaudeLogo from './ClaudeLogo.jsx';
import TodoList from './TodoList';

// Format "Claude AI usage limit reached|<epoch>" into a local time string
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

export interface SimpleImage {
  data: string;
  name: string;
}

/**
 * Message block component props
 */
export interface MessageComponentProps {
  message: ChatMessage;
  prevMessage?: ChatMessage;
  nextMessage?: ChatMessage;
  createDiff: (oldStr: string, newStr: string) => string;
  onFileOpen: (path: string, diffInfo: DiffInfo | null) => void;
  onShowSettings: () => void;
  autoExpandTools: boolean;
  showRawParameters: boolean;
}

// Memoized message component to prevent unnecessary re-renders
// eslint-disable-next-line no-unused-vars
export const MessageComponent = memo<MessageComponentProps>(
  ({
    message,
    prevMessage,
    nextMessage,
    createDiff,
    onFileOpen,
    onShowSettings,
    autoExpandTools,
    showRawParameters,
  }) => {
    // Group consecutive messages from Claude (assistant, tool uses, tool results, hook feedback)
    const isClaudeMessage = (msg: ChatMessage) =>
      msg.type === 'assistant' ||
      msg.type === 'tool' ||
      msg.type === 'tool_result' ||
      msg.type === 'hook_feedback' ||
      msg.isToolUse;

    // For user messages, check if previous message was also a user message
    // For Claude messages, check if previous message was also a Claude message
    const isGrouped =
      message.type === 'user'
        ? prevMessage && prevMessage.type === 'user'
        : prevMessage && isClaudeMessage(prevMessage) && isClaudeMessage(message);

    const messageRef = React.useRef(null);
    const [isExpanded, setIsExpanded] = React.useState(false);
    React.useEffect(() => {
      if (!autoExpandTools || !messageRef.current || !message.isToolUse) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !isExpanded) {
              setIsExpanded(true);
              // Find details elements that have the open attribute set to autoExpandTools
              // This respects the individual tool's open attribute setting
              const details = messageRef.current.querySelectorAll(
                'details[data-auto-expand="true"]',
              );
              details.forEach((detail) => {
                detail.open = true;
              });
            }
          });
        },
        { threshold: 0.1 },
      );

      observer.observe(messageRef.current);

      return () => {
        if (messageRef.current) {
          observer.unobserve(messageRef.current);
        }
      };
    }, [autoExpandTools, isExpanded, message.isToolUse]);

    return (
      <div
        ref={messageRef}
        className={`chat-message ${message.type} ${isGrouped ? 'grouped' : ''} ${message.type === 'user' ? 'flex justify-end px-3 sm:px-0' : 'px-3 sm:px-0'}`}
        data-id={message.id}
      >
        {message.type === 'hook_feedback' ? (
          /* Hook feedback message - rendered as a special Claude message */
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 bg-purple-500 dark:bg-purple-600 rounded-full flex items-center justify-center text-white text-xs">
                🪝
              </div>
            </div>
            <div className="flex-1">
              <details className="group">
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 transition-transform group-open:rotate-90 text-gray-600 dark:text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Claude Hook
                    </span>
                    <span className="text-xs text-purple-600 dark:text-purple-400">
                      System Feedback
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </summary>
                <div className="mt-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                  <pre className="whitespace-pre-wrap text-sm text-purple-900 dark:text-purple-100 font-mono">
                    {message.content}
                  </pre>
                </div>
              </details>
            </div>
          </div>
        ) : message.type ===
          'tool_result' /* Tool result message - skip rendering as standalone, will be shown with tool use */ ? null : message.type ===
          'user' ? (
          /* User message bubble on the right */
          <div className="flex items-end space-x-0 sm:space-x-3 w-full sm:w-auto sm:max-w-[85%] md:max-w-md lg:max-w-lg xl:max-w-xl">
            <div className="bg-blue-600 text-white rounded-2xl rounded-br-md px-3 sm:px-4 py-2 shadow-sm flex-1 sm:flex-initial">
              <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
              {message.images && message.images.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {message.images.map((img: SimpleImage, idx: number) => (
                    <img
                      key={idx}
                      src={img.data}
                      alt={img.name}
                      className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(img.data, '_blank')}
                    />
                  ))}
                </div>
              )}
            </div>
            {!isGrouped && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0">
                  U
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Claude/Error/Tool messages on the left */
          <div className="w-full">
            {!isGrouped && (
              <div className="flex items-center space-x-3 mb-2">
                {message.type === 'error' ? (
                  <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0">
                    !
                  </div>
                ) : message.type === 'tool' ? (
                  <div className="w-8 h-8 bg-gray-600 dark:bg-gray-700 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0">
                    🔧
                  </div>
                ) : message.type === 'tool_result' ? (
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 ${
                      message.isError
                        ? 'bg-red-500 dark:bg-red-600'
                        : 'bg-green-500 dark:bg-green-600'
                    }`}
                  >
                    {message.isError ? '✗' : '✓'}
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0 p-1">
                    {(localStorage.getItem('selected-provider') || 'claude') === 'cursor' ? (
                      <ClaudeLogo className="w-full h-full" />
                    ) : (
                      <ClaudeLogo className="w-full h-full" />
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {message.type === 'error'
                      ? 'Error'
                      : message.type === 'tool'
                        ? 'Tool'
                        : message.type === 'tool_result'
                          ? 'Tool Result'
                          : (localStorage.getItem('selected-provider') || 'claude') === 'cursor'
                            ? 'Cursor'
                            : 'Claude'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )}

            <div className="w-full">
              {message.isToolUse &&
              message.toolName &&
              !['Read', 'TodoWrite', 'TodoRead'].includes(message.toolName) ? (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 sm:p-3 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </div>
                      <span className="font-medium text-blue-900 dark:text-blue-100">
                        Using {message.toolName}
                      </span>
                      {!message.toolResult && message.toolId && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                          {message.toolId}
                        </span>
                      )}
                    </div>
                    {onShowSettings && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowSettings();
                        }}
                        className="p-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                        title="Tool Settings"
                      >
                        <svg
                          className="w-4 h-4 text-blue-600 dark:text-blue-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                  {message.toolInput &&
                    message.toolName === 'Edit' &&
                    (() => {
                      try {
                        const input = JSON.parse(message.toolInput);
                        if (input.file_path && input.old_string && input.new_string) {
                          return (
                            <details className="mt-2">
                              <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-2">
                                <svg
                                  className="w-4 h-4 transition-transform details-chevron"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                  />
                                </svg>
                                📝 View edit diff for
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onFileOpen &&
                                      onFileOpen(input.file_path, {
                                        old_string: input.old_string,
                                        new_string: input.new_string,
                                      });
                                  }}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline font-mono"
                                >
                                  {input.file_path.split('/').pop()}
                                </button>
                              </summary>
                              <div className="mt-3">
                                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                  <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                    <a
                                      href={`cursor://file/${encodeURIComponent(input.file_path)}`}
                                      className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate underline cursor-pointer"
                                    >
                                      {input.file_path}
                                    </a>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      Diff
                                    </span>
                                  </div>
                                  <div className="text-xs font-mono">
                                    {createDiff(input.old_string, input.new_string).map(
                                      (diffLine, i) => (
                                        <div key={i} className="flex">
                                          <span
                                            className={`w-8 text-center border-r ${
                                              diffLine.type === 'removed'
                                                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                                                : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
                                            }`}
                                          >
                                            {diffLine.type === 'removed' ? '-' : '+'}
                                          </span>
                                          <span
                                            className={`px-2 py-0.5 flex-1 whitespace-pre-wrap ${
                                              diffLine.type === 'removed'
                                                ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                                                : 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                                            }`}
                                          >
                                            {diffLine.content}
                                          </span>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                                {showRawParameters && (
                                  <details
                                    className="mt-2"
                                    open={autoExpandTools}
                                    data-auto-expand="true"
                                  >
                                    <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300">
                                      View raw parameters
                                    </summary>
                                    <pre className="mt-2 text-xs bg-blue-100 dark:bg-blue-800/30 p-2 rounded whitespace-pre-wrap break-words overflow-hidden text-blue-900 dark:text-blue-100">
                                      {message.toolInput}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            </details>
                          );
                        }
                      } catch (e) {
                        // Fall back to raw display if parsing fails
                      }
                      return (
                        <details className="mt-2" open={autoExpandTools} data-auto-expand="true">
                          <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200">
                            View input parameters
                          </summary>
                          <pre className="mt-2 text-xs bg-blue-100 dark:bg-blue-800/30 p-2 rounded whitespace-pre-wrap break-words overflow-hidden text-blue-900 dark:text-blue-100">
                            {message.toolInput}
                          </pre>
                        </details>
                      );
                    })()}
                  {message.toolInput &&
                    message.toolName !== 'Edit' &&
                    (() => {
                      // Debug log to see what we're dealing with

                      // Special handling for Write tool
                      if (message.toolName === 'Write') {
                        try {
                          let input;
                          // Handle both JSON string and already parsed object
                          if (typeof message.toolInput === 'string') {
                            input = JSON.parse(message.toolInput);
                          } else {
                            input = message.toolInput;
                          }

                          if (input.file_path && input.content !== undefined) {
                            return (
                              <details className="mt-2">
                                <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-2">
                                  <svg
                                    className="w-4 h-4 transition-transform details-chevron"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                  📄 Creating new file:
                                  <a
                                    href={`cursor://file/${encodeURIComponent(input.file_path)}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline font-mono"
                                  >
                                    {input.file_path.split('/').pop()}
                                  </a>
                                </summary>
                                <div className="mt-3">
                                  <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                    <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                      <a
                                        href={`cursor://file/${encodeURIComponent(input.file_path)}`}
                                        className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate underline cursor-pointer"
                                      >
                                        {input.file_path}
                                      </a>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        New File
                                      </span>
                                    </div>
                                    <div className="text-xs font-mono">
                                      {createDiff('', input.content).map((diffLine, i) => (
                                        <div key={i} className="flex">
                                          <span
                                            className={`w-8 text-center border-r ${
                                              diffLine.type === 'removed'
                                                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
                                                : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
                                            }`}
                                          >
                                            {diffLine.type === 'removed' ? '-' : '+'}
                                          </span>
                                          <span
                                            className={`px-2 py-0.5 flex-1 whitespace-pre-wrap ${
                                              diffLine.type === 'removed'
                                                ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                                                : 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                                            }`}
                                          >
                                            {diffLine.content}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  {showRawParameters && (
                                    <details
                                      className="mt-2"
                                      open={autoExpandTools}
                                      data-auto-expand="true"
                                    >
                                      <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300">
                                        View raw parameters
                                      </summary>
                                      <pre className="mt-2 text-xs bg-blue-100 dark:bg-blue-800/30 p-2 rounded whitespace-pre-wrap break-words overflow-hidden text-blue-900 dark:text-blue-100">
                                        {message.toolInput}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              </details>
                            );
                          }
                        } catch (e) {
                          // Fall back to regular display
                        }
                      }

                      // Special handling for TodoWrite tool
                      if (message.toolName === 'TodoWrite') {
                        try {
                          const input = JSON.parse(message.toolInput);
                          if (input.todos && Array.isArray(input.todos)) {
                            return (
                              <details
                                className="mt-2"
                                open={autoExpandTools}
                                data-auto-expand="true"
                              >
                                <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-2">
                                  <svg
                                    className="w-4 h-4 transition-transform details-chevron"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                  Updating Todo List
                                </summary>
                                <div className="mt-3">
                                  <TodoList todos={input.todos} />
                                  {showRawParameters && (
                                    <details
                                      className="mt-3"
                                      open={autoExpandTools}
                                      data-auto-expand="true"
                                    >
                                      <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300">
                                        View raw parameters
                                      </summary>
                                      <pre className="mt-2 text-xs bg-blue-100 dark:bg-blue-800/30 p-2 rounded overflow-x-auto text-blue-900 dark:text-blue-100">
                                        {message.toolInput}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              </details>
                            );
                          }
                        } catch (e) {
                          // Fall back to regular display
                        }
                      }

                      // Special handling for Bash tool
                      if (message.toolName === 'Bash') {
                        try {
                          const input = JSON.parse(message.toolInput);
                          return (
                            <details className="mt-2">
                              <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-2">
                                <svg
                                  className="w-4 h-4 transition-transform details-chevron"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                  />
                                </svg>
                                Running command
                              </summary>
                              <div className="mt-3 space-y-2">
                                <div className="bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg p-3 font-mono text-sm">
                                  <div className="flex items-center gap-2 mb-2 text-gray-400">
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                      />
                                    </svg>
                                    <span className="text-xs">Terminal</span>
                                  </div>
                                  <div className="whitespace-pre-wrap break-all text-green-400">
                                    $ {input.command}
                                  </div>
                                </div>
                                {input.description && (
                                  <div className="text-xs text-gray-600 dark:text-gray-400 italic">
                                    {input.description}
                                  </div>
                                )}
                                {showRawParameters && (
                                  <details className="mt-2">
                                    <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300">
                                      View raw parameters
                                    </summary>
                                    <pre className="mt-2 text-xs bg-blue-100 dark:bg-blue-800/30 p-2 rounded whitespace-pre-wrap break-words overflow-hidden text-blue-900 dark:text-blue-100">
                                      {message.toolInput}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            </details>
                          );
                        } catch (e) {
                          // Fall back to regular display
                        }
                      }

                      // Special handling for Read tool
                      if (message.toolName === 'Read') {
                        try {
                          const input = JSON.parse(message.toolInput);
                          if (input.file_path) {
                            const filename = input.file_path.split('/').pop();

                            return (
                              <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                                Read{' '}
                                <a
                                  href={`cursor://file/${encodeURIComponent(input.file_path)}`}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline font-mono"
                                >
                                  {filename}
                                </a>
                              </div>
                            );
                          }
                        } catch (e) {
                          // Fall back to regular display
                        }
                      }

                      // Special handling for MultiEdit tool
                      if (message.toolName === 'MultiEdit') {
                        try {
                          const input = JSON.parse(message.toolInput);
                          if (input.file_path && Array.isArray(input.edits)) {
                            const editCount = input.edits.length;
                            return (
                              <details className="mt-2">
                                <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-2">
                                  <svg
                                    className="w-4 h-4 transition-transform details-chevron"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                  📝 View {editCount} edit{editCount !== 1 ? 's' : ''} for
                                  <a
                                    href={`cursor://file/${input.file_path}`}
                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline font-mono ml-1"
                                  >
                                    {input.file_path.split('/').pop()}
                                  </a>
                                </summary>
                                <div className="mt-3 space-y-3">
                                  {input.edits.map((edit, index: number) => (
                                    <div
                                      key={index}
                                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                                    >
                                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                        Edit {index + 1} of {editCount}
                                      </div>
                                      <div className="grid grid-cols-1 gap-2">
                                        <div>
                                          <div className="text-xs text-red-600 dark:text-red-400 mb-1">
                                            - Old
                                          </div>
                                          <pre className="text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded overflow-x-auto text-red-800 dark:text-red-200">
                                            {edit.old_string}
                                          </pre>
                                        </div>
                                        <div>
                                          <div className="text-xs text-green-600 dark:text-green-400 mb-1">
                                            + New
                                          </div>
                                          <pre className="text-xs bg-green-50 dark:bg-green-900/20 p-2 rounded overflow-x-auto text-green-800 dark:text-green-200">
                                            {edit.new_string}
                                          </pre>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  {showRawParameters && (
                                    <details
                                      className="mt-3"
                                      open={autoExpandTools}
                                      data-auto-expand="true"
                                    >
                                      <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300">
                                        View raw parameters
                                      </summary>
                                      <pre className="mt-2 text-xs bg-blue-100 dark:bg-blue-800/30 p-2 rounded overflow-x-auto text-blue-900 dark:text-blue-100">
                                        {message.toolInput}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              </details>
                            );
                          }
                        } catch (e) {
                          // Fall back to regular display if parsing fails
                        }
                      }

                      // Special handling for exit_plan_mode tool
                      if (message.toolName === 'exit_plan_mode') {
                        try {
                          const input = JSON.parse(message.toolInput);
                          if (input.plan) {
                            // Replace escaped newlines with actual newlines
                            const planContent = input.plan.replace(/\\n/g, '\n');
                            return (
                              <details
                                className="mt-2"
                                open={autoExpandTools}
                                data-auto-expand="true"
                              >
                                <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-2">
                                  <svg
                                    className="w-4 h-4 transition-transform details-chevron"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                  📋 View implementation plan
                                </summary>
                                <div className="mt-3 prose prose-sm max-w-none dark:prose-invert">
                                  <ReactMarkdown>{planContent}</ReactMarkdown>
                                </div>
                              </details>
                            );
                          }
                        } catch (e) {
                          // Fall back to regular display
                        }
                      }

                      // Regular tool input display for other tools
                      return (
                        <details className="mt-2" open={autoExpandTools} data-auto-expand="true">
                          <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-2">
                            <svg
                              className="w-4 h-4 transition-transform details-chevron"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                            View input parameters
                          </summary>
                          <pre className="mt-2 text-xs bg-blue-100 dark:bg-blue-800/30 p-2 rounded whitespace-pre-wrap break-words overflow-hidden text-blue-900 dark:text-blue-100">
                            {message.toolInput}
                          </pre>
                        </details>
                      );
                    })()}

                  {/* Tool Result Section - check if next message is a tool result */}
                  {nextMessage && nextMessage.type === 'tool_result' && (
                    <div className="mt-3 border-t border-blue-200 dark:border-blue-700 pt-3">
                      <details className="group">
                        <summary className="cursor-pointer list-none hover:opacity-80">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <svg
                                className="w-4 h-4 transition-transform group-open:rotate-90 text-blue-600 dark:text-blue-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                              <div
                                className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                  nextMessage.isError
                                    ? 'bg-red-500 dark:bg-red-600'
                                    : 'bg-green-500 dark:bg-green-600'
                                }`}
                              >
                                <svg
                                  className="w-3 h-3 text-white"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  {nextMessage.isError ? (
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  ) : (
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 13l4 4L19 7"
                                    />
                                  )}
                                </svg>
                              </div>
                              <span
                                className={`text-sm font-medium ${
                                  nextMessage.isError
                                    ? 'text-red-700 dark:text-red-300'
                                    : 'text-green-700 dark:text-green-300'
                                }`}
                              >
                                {nextMessage.isError ? 'Tool Error' : 'Tool Result'}
                              </span>
                            </div>
                            <svg
                              className="w-4 h-4 text-gray-400 group-open:hidden"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                        </summary>
                        <div
                          className={`mt-2 text-sm rounded-lg p-3 ${
                            nextMessage.isError
                              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                              : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                          }`}
                        >
                          <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                            {nextMessage.content}
                          </pre>
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              ) : message.isInteractivePrompt ? (
                // Special handling for interactive prompts
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-900 dark:text-amber-100 text-base mb-3">
                        Interactive Prompt
                      </h4>
                      {(() => {
                        const lines = message.content.split('\n').filter((line) => line.trim());
                        const questionLine =
                          lines.find((line) => line.includes('?')) || lines[0] || '';
                        const options: { number?: string; text?: string; isSelected: boolean }[] =
                          [];

                        // Parse the menu options
                        lines.forEach((line) => {
                          // Match lines like "❯ 1. Yes" or "  2. No"
                          const optionMatch = line.match(/[❯\s]*(\d+)\.\s+(.+)/);
                          if (optionMatch) {
                            const isSelected = line.includes('❯');

                            options.push({
                              number: optionMatch[1],
                              text: optionMatch[2]?.trim(),
                              isSelected,
                            });
                          }
                        });

                        return (
                          <>
                            <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">
                              {questionLine}
                            </p>

                            {/* Option buttons */}
                            <div className="space-y-2 mb-4">
                              {options.map((option) => (
                                <button
                                  key={option.number}
                                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                                    option.isSelected
                                      ? 'bg-amber-600 dark:bg-amber-700 text-white border-amber-600 dark:border-amber-700 shadow-md'
                                      : 'bg-white dark:bg-gray-800 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-700'
                                  } cursor-not-allowed opacity-75`}
                                  disabled
                                >
                                  <div className="flex items-center gap-3">
                                    <span
                                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                        option.isSelected
                                          ? 'bg-white/20'
                                          : 'bg-amber-100 dark:bg-amber-800/50'
                                      }`}
                                    >
                                      {option.number}
                                    </span>
                                    <span className="text-sm sm:text-base font-medium flex-1">
                                      {option.text}
                                    </span>
                                    {option.isSelected && <span className="text-lg">❯</span>}
                                  </div>
                                </button>
                              ))}
                            </div>

                            <div className="bg-amber-100 dark:bg-amber-800/30 rounded-lg p-3">
                              <p className="text-amber-900 dark:text-amber-100 text-sm font-medium mb-1">
                                ⏳ Waiting for your response in the CLI
                              </p>
                              <p className="text-amber-800 dark:text-amber-200 text-xs">
                                Please select an option in your terminal where Claude is running.
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ) : message.isToolUse && message.toolName === 'Read' ? (
                // Simple Read tool indicator
                (() => {
                  try {
                    const input = JSON.parse(message.toolInput);
                    if (input.file_path) {
                      const filename = input.file_path.split('/').pop();
                      return (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-300 dark:border-blue-600 pl-3 py-1 mb-2 text-sm text-blue-700 dark:text-blue-300">
                          📖 Read{' '}
                          <a
                            href={`cursor://file/${encodeURIComponent(input.file_path)}`}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline font-mono"
                          >
                            {filename}
                          </a>
                        </div>
                      );
                    }
                  } catch (e) {
                    return (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-300 dark:border-blue-600 pl-3 py-1 mb-2 text-sm text-blue-700 dark:text-blue-300">
                        📖 Read file
                      </div>
                    );
                  }
                })()
              ) : message.isToolUse && message.toolName === 'TodoWrite' ? (
                // Simple TodoWrite tool indicator with tasks
                (() => {
                  try {
                    if (message?.toolInput) {
                      const input = JSON.parse(message.toolInput);
                      if (input.todos && Array.isArray(input.todos)) {
                        return (
                          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-300 dark:border-blue-600 pl-3 py-1 mb-2">
                            <div className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                              📝 Update todo list
                            </div>
                            <TodoList todos={input.todos} />
                          </div>
                        );
                      }
                    }
                    return null;
                  } catch (e) {
                    return (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-300 dark:border-blue-600 pl-3 py-1 mb-2 text-sm text-blue-700 dark:text-blue-300">
                        📝 Update todo list
                      </div>
                    );
                  }
                })()
              ) : message.isToolUse && message.toolName === 'TodoRead' ? (
                // Simple TodoRead tool indicator
                <div className="bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-300 dark:border-blue-600 pl-3 py-1 mb-2 text-sm text-blue-700 dark:text-blue-300">
                  📋 Read todo list
                </div>
              ) : (
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  {/* Thinking accordion for reasoning */}
                  {message.reasoning && (
                    <details className="mb-3">
                      <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium">
                        💭 Thinking...
                      </summary>
                      <div className="mt-2 pl-4 border-l-2 border-gray-300 dark:border-gray-600 italic text-gray-600 dark:text-gray-400 text-sm">
                        <div className="whitespace-pre-wrap">{message.reasoning}</div>
                      </div>
                    </details>
                  )}

                  {message.type === 'assistant' ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert prose-gray [&_code]:!bg-transparent [&_code]:!p-0 [&_pre]:!bg-transparent [&_pre]:!border-0 [&_pre]:!p-0">
                      <ReactMarkdown
                        components={{
                          code: ({ node, inline, className, children, ...props }) => {
                            return inline ? (
                              <strong
                                className="text-blue-600 dark:text-blue-400 font-bold not-prose"
                                {...props}
                              >
                                {children}
                              </strong>
                            ) : (
                              <div className="bg-gray-800 dark:bg-gray-800 border border-gray-600/30 dark:border-gray-600/30 p-3 rounded-lg overflow-hidden my-2">
                                <code
                                  className="text-gray-100 dark:text-gray-200 text-sm font-mono block whitespace-pre-wrap break-words"
                                  {...props}
                                >
                                  {children}
                                </code>
                              </div>
                            );
                          },
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400 my-2">
                              {children}
                            </blockquote>
                          ),
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {children}
                            </a>
                          ),
                          p: ({ children }) => <div className="mb-2 last:mb-0">{children}</div>,
                        }}
                      >
                        {formatUsageLimitText(String(message.content || ''))}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">
                      {formatUsageLimitText(String(message.content || ''))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);
