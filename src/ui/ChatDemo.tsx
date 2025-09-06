import React, { useEffect, useState } from 'react';
import { ChatInterface } from './components/ChatInterface';
import type { SessionMessage } from '@shared/claude/types';

// Import test data loader
import { loadPerloxSession } from './utilities/testDataLoader';

export const ChatDemo: React.FC = () => {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTestData = async () => {
      try {
        setIsLoading(true);
        // Load messages from the perlox test session
        const sessionMessages = await loadPerloxSession();
        setMessages(sessionMessages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load test data');
        console.error('Error loading test data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTestData();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md">
          <h2 className="text-red-600 dark:text-red-400 font-semibold text-lg mb-2">
            Error Loading Demo
          </h2>
          <p className="text-gray-700 dark:text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          Loading perlox session data...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <ChatInterface initialMessages={messages} />
    </div>
  );
};
