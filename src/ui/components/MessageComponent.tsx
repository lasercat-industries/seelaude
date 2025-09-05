import React, { memo, useRef, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { SessionMessage } from '@shared/claude/types';

// Format "Claude AI usage limit reached|<epoch>" into a local time string
function formatUsageLimitText(text: any): string {
  try {
    if (typeof text !== 'string') return text;
    return text.replace(/Claude AI usage limit reached\|(\d{10,13})/g, (match: string, ts: string) => {
      let timestampMs = parseInt(ts, 10);
      if (!Number.isFinite(timestampMs)) return match;
      if (timestampMs < 1e12) timestampMs *= 1000; // seconds → ms
      const reset = new Date(timestampMs);

      // Time HH:mm in local time
      const timeStr = new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
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
        .replace(/\b\w/g, c => c.toUpperCase());
      const tzHuman = city ? `${gmt} (${city})` : gmt;

      // Readable date like "8 Jun 2025"
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const dateReadable = `${reset.getDate()} ${months[reset.getMonth()]} ${reset.getFullYear()}`;

      return `Claude usage limit reached. Your limit will reset at **${timeStr} ${tzHuman}** - ${dateReadable}`;
    });
  } catch {
    return text;
  }
}

interface ExtendedMessage extends Omit<SessionMessage, 'type'> {
  type: 'user' | 'assistant' | 'system' | 'error';
  isToolUse?: boolean;
  toolName?: string;
  toolId?: string;
  toolInput?: string;
  toolResult?: {
    content: string;
    isError: boolean;
  };
  reasoning?: string;
  images?: Array<{ data: string; name: string }>;
}

interface MessageComponentProps {
  message: ExtendedMessage;
  prevMessage?: ExtendedMessage;
  autoExpandTools?: boolean;
}

export const MessageComponent = memo<MessageComponentProps>(({ 
  message, 
  prevMessage, 
  autoExpandTools = false 
}) => {
  const isGrouped = prevMessage && prevMessage.type === message.type && 
                   prevMessage.type === 'assistant' && 
                   !(prevMessage as any).isToolUse && !message.isToolUse;
  const messageRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!autoExpandTools || !messageRef.current || !message.isToolUse) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isExpanded) {
            setIsExpanded(true);
            // Find all details elements and open them
            const details = messageRef.current?.querySelectorAll('details');
            details?.forEach(detail => {
              detail.open = true;
            });
          }
        });
      },
      { threshold: 0.1 }
    );
    
    observer.observe(messageRef.current);
    
    return () => {
      if (messageRef.current) {
        observer.unobserve(messageRef.current);
      }
    };
  }, [autoExpandTools, isExpanded, message.isToolUse]);

  // Extract content string from message
  const getMessageContent = (): string => {
    if (!message.message?.content) return '';
    if (typeof message.message.content === 'string') {
      return message.message.content;
    }
    // Handle array content - find first text item
    if (Array.isArray(message.message.content)) {
      const textItem = message.message.content.find((item: any) => 
        item?.type === 'text' && item?.text
      );
      return String(textItem?.text || '');
    }
    return '';
  };

  const content: string = getMessageContent();

  return (
    <div
      ref={messageRef}
      className={`chat-message ${message.type} ${isGrouped ? 'grouped' : ''} ${message.type === 'user' ? 'flex justify-end px-3 sm:px-0' : 'px-3 sm:px-0'}`}
    >
      {message.type === 'user' ? (
        /* User message bubble on the right */
        <div className="flex items-end space-x-0 sm:space-x-3 w-full sm:w-auto sm:max-w-[85%] md:max-w-md lg:max-w-lg xl:max-w-xl">
          <div className="bg-blue-600 text-white rounded-2xl rounded-br-md px-3 sm:px-4 py-2 shadow-sm flex-1 sm:flex-initial">
            <div className="text-sm whitespace-pre-wrap break-words">
              {String(content || '')}
            </div>
            {message.images && message.images.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {message.images.map((img, idx) => (
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
            <div className="text-xs text-blue-100 mt-1 text-right">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
          {!isGrouped && (
            <div className="hidden sm:flex w-8 h-8 bg-blue-600 rounded-full items-center justify-center text-white text-sm flex-shrink-0">
              U
            </div>
          )}
        </div>
      ) : (
        /* Assistant/Error/Tool messages on the left */
        <div className="w-full">
          {!isGrouped && (
            <div className="flex items-center space-x-3 mb-2">
              {message.type === 'error' ? (
                <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0">
                  !
                </div>
              ) : (
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 text-sm flex-shrink-0">
                  C
                </div>
              )}
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {message.type === 'error' ? 'Error' : 'Claude'}
              </div>
            </div>
          )}
          
          <div className="w-full">
            {message.isToolUse ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2 sm:p-3 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="font-medium text-blue-900 dark:text-blue-100">
                      Using {message.toolName}
                    </span>
                    {message.toolId && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                        {message.toolId}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Tool input parameters */}
                {message.toolInput && (
                  <details className="mt-2" open={autoExpandTools}>
                    <summary className="text-sm text-blue-700 dark:text-blue-300 cursor-pointer hover:text-blue-800 dark:hover:text-blue-200 flex items-center gap-2">
                      <svg className="w-4 h-4 transition-transform details-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      View input parameters
                    </summary>
                    <pre className="mt-2 text-xs bg-blue-100 dark:bg-blue-800/30 p-2 rounded whitespace-pre-wrap break-words overflow-hidden text-blue-900 dark:text-blue-100">
                      {message.toolInput}
                    </pre>
                  </details>
                )}
                
                {/* Tool Result Section */}
                {message.toolResult && (
                  <div className="mt-3 border-t border-blue-200 dark:border-blue-700 pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-4 h-4 rounded flex items-center justify-center ${
                        message.toolResult.isError 
                          ? 'bg-red-500' 
                          : 'bg-green-500'
                      }`}>
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {message.toolResult.isError ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          )}
                        </svg>
                      </div>
                      <span className={`text-sm font-medium ${
                        message.toolResult.isError 
                          ? 'text-red-700 dark:text-red-300' 
                          : 'text-green-700 dark:text-green-300'
                      }`}>
                        {message.toolResult.isError ? 'Tool Error' : 'Tool Result'}
                      </span>
                    </div>
                    
                    <div className={`text-sm ${
                      message.toolResult.isError 
                        ? 'text-red-800 dark:text-red-200' 
                        : 'text-green-800 dark:text-green-200'
                    }`}>
                      <div className="prose prose-sm max-w-none prose-green dark:prose-invert">
                        <ReactMarkdown>{String(message.toolResult.content || '')}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}
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
                      <div className="whitespace-pre-wrap">
                        {message.reasoning}
                      </div>
                    </div>
                  </details>
                )}
                
                {message.type === 'assistant' ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-gray">
                    <ReactMarkdown
                      components={{
                        code: ({className, children, ...props}: any) => {
                          const inline = !className;
                          return inline ? (
                            <strong className="text-blue-600 dark:text-blue-400 font-bold not-prose" {...props}>
                              {children}
                            </strong>
                          ) : (
                            <div className="bg-gray-800 dark:bg-gray-900 border border-gray-600/30 dark:border-gray-600/30 p-3 rounded-lg overflow-hidden my-2">
                              <code className="text-gray-100 dark:text-gray-200 text-sm font-mono block whitespace-pre-wrap break-words" {...props}>
                                {children}
                              </code>
                            </div>
                          );
                        },
                        blockquote: ({children}: any) => (
                          <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400 my-2">
                            {children}
                          </blockquote>
                        ),
                        a: ({href, children}: any) => (
                          <a href={href} className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">
                            {children}
                          </a>
                        ),
                        p: ({children}: any) => (
                          <div className="mb-2 last:mb-0">
                            {children}
                          </div>
                        )
                      }}
                    >
                      {formatUsageLimitText(content)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">
                    {formatUsageLimitText(content)}
                  </div>
                )}
              </div>
            )}
            
            <div className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${isGrouped ? 'opacity-0 group-hover:opacity-100' : ''}`}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

MessageComponent.displayName = 'MessageComponent';