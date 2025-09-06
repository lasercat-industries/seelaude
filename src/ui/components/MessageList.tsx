import React, { useRef, useEffect } from 'react';
import type { ChatMessage, DiffInfo } from './types';
import { MessageComponent } from './MessageComponent';

interface MessageListProps {
  messages: ChatMessage[];
  className?: string;
  autoExpandTools?: boolean;
  createDiff: (oldStr: string, newStr: string) => string;
  onFileOpen: (path: string, diffInfo: DiffInfo | null) => void;
  onShowSettings: () => void;
  showRawParameters: boolean;
}
  
export const MessageList: React.FC<MessageListProps> = ({
  messages,
  className = '',
  autoExpandTools = false,
  createDiff,
  onFileOpen,
  onShowSettings,
  showRawParameters,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div
      ref={listRef}
      className={`flex flex-col h-full overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4 scrollbar-hide ${className}`}
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {messages.map((message, index) => (
        <MessageComponent
          key={message.uuid || `${message.sessionId}-${index}`}
          message={message}
          prevMessage={index > 0 ? (messages[index - 1]) : undefined}
          createDiff={createDiff}
          onFileOpen={onFileOpen}
          onShowSettings={onShowSettings}
          autoExpandTools={autoExpandTools}
          showRawParameters={showRawParameters}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};
