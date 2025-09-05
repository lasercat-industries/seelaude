import React, { useEffect, useState } from 'react';
// @ts-ignore - JSX file
import ChatInterfaceNew from './components/ChatInterfaceNew';
import type { SessionMessage } from '@shared/claude/types';
import { loadPerloxSession } from './utilities/testDataLoader';
import { useWebSocketContext, WebSocketProvider } from './contexts/WebSocketContext';

export const ChatDemoNew: React.FC = () => {
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [selectedProject, setSelectedProject] = useState({
    name: '-Users-rylandgoldstein-repos-perlox',
    path: '/Users/rylandgoldstein/repos/perlox',
    fullPath: '/Users/rylandgoldstein/repos/perlox',
    displayName: 'Perlox Demo',
  });
  // const [selectedSession, setSelectedSession] = useState({
  //   id: 'cd5c1ea3-a0da-45ad-ac12-fa5c51f5e913',
  //   title:
  //     '# /setup\n\nCreate the boilerplate infrastructure for claude code in this project\n\n## Rules\n\nNever add...',
  //   created: '2025-08-27T17:26:08.998Z',
  //   lastActivity: '2025-08-27T17:30:38.469Z',
  // });
  const [selectedSession, setSelectedSession] = useState({
    id: '026fe348-9a93-49e0-bdab-5feea5e8e428',
    summary: 'spec approved, please proceed',
    lastActivity: '2025-08-27T20:10:21.222Z',
    messageCount: 259,
    created: '2025-08-27T18:03:26.608Z',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { ws, sendMessage, messages: wMessages } = useWebSocketContext();

  useEffect(() => {
    const loadTestData = async () => {
      try {
        setIsLoading(true);
        // Load messages from the perlox test session
        const sessionMessages = await loadPerloxSession();
        console.log(
          'Loaded',
          sessionMessages.length,
          'messages from utilities/935f5343-163f-461b-a7f3-c7e9b3a4a686.jsonl',
        );
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
    <div className="h-screen" style={{ backgroundColor: '#0f172a' }}>
      <ChatInterfaceNew
        selectedProject={selectedProject}
        selectedSession={selectedSession}
        ws={ws}
        sendMessage={sendMessage}
        messages={wMessages}
        onFileOpen={() => {}}
        onInputFocusChange={() => {}}
        onSessionActive={() => {}}
        onSessionInactive={() => {}}
        onReplaceTemporarySession={() => {}}
        onNavigateToSession={() => {}}
        onShowSettings={() => {}}
        autoExpandTools={true}
        showRawParameters={false}
        autoScrollToBottom={true}
        sendByCtrlEnter={false}
        onTaskClick={() => {}}
        onShowAllTasks={() => {}}
      />
    </div>
  );
};
