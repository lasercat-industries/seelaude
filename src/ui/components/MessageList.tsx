import React, { useRef, useEffect } from 'react';
import type { SessionMessage } from '@shared/claude/types';
import { MessageComponent } from './OldMessageComponent';

interface MessageListProps {
  messages: SessionMessage[];
  className?: string;
  autoExpandTools?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  className = '',
  autoExpandTools = false,
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
          message={message as any}
          prevMessage={index > 0 ? (messages[index - 1] as any) : undefined}
          autoExpandTools={autoExpandTools}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};
