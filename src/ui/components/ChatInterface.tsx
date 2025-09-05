import React, { useEffect, useState } from 'react';
import type { SessionMessage } from '@shared/claude/types';
import { MessageList } from './MessageList';
import { convertSessionMessages } from '../utilities/messageUtils';

interface ChatInterfaceProps {
  initialMessages?: SessionMessage[];
  className?: string;
  autoExpandTools?: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  initialMessages = [],
  className = '',
  autoExpandTools = false
}) => {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [isLoading] = useState(false);

  useEffect(() => {
    if (initialMessages.length > 0) {
      // Convert messages for display
      const converted = convertSessionMessages(initialMessages);
      setMessages(converted);
    }
  }, [initialMessages]);

  return (
    <div className={`h-full bg-white dark:bg-gray-900 ${className}`}>
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500 dark:text-gray-400">Loading messages...</div>
        </div>
      ) : messages.length > 0 ? (
        <MessageList messages={messages} autoExpandTools={autoExpandTools} />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500 dark:text-gray-400">No messages to display</div>
        </div>
      )}
    </div>
  );
};