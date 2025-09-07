import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import { useWebSocketContext } from './contexts/WebSocketContext';
import { api } from './utils/api';

export const ChatDemo: React.FC = () => {
  const [selectedProject] = useState({
    name: '-Users-rylandgoldstein-repos-perlox',
    path: '/Users/rylandgoldstein/repos/perlox',
    fullPath: '/Users/rylandgoldstein/repos/perlox',
    displayName: 'Perlox Demo',
    sessions: [],
  });

  const initialSession = {
    id: 'cd484e20-66aa-40f0-975b-1e76192da1c3',
    summary: 'spec approved, please proceed',
    lastActivity: '2025-08-27T20:10:21.222Z',
    messageCount: 259,
    created: '2025-08-27T18:03:26.608Z',
  };

  const [selectedSession, setSelectedSession] = useState(initialSession);
  const [isLoading, setIsLoading] = useState(true);

  // const [selectedProject] = useState();

  // const [selectedSession] = useState();

  const { ws, sendMessage, messages: wMessages } = useWebSocketContext();

  useEffect(() => {
    const fetchLatestDescendant = async () => {
      try {
        const response = await api.getLatestDescendant(
          selectedProject.name,
          initialSession.id,
        );
        if (!response.ok) {
          throw new Error('Failed to load latest descendant');
        }
        const latestSessionId = await response.json();
        
        // Update the session with the latest descendant ID
        setSelectedSession({
          ...initialSession,
          id: latestSessionId,
        });
      } catch (error) {
        console.error('Error fetching latest descendant:', error);
        // Keep the original session on error
      } finally {
        setIsLoading(false);
      }
    };

    void fetchLatestDescendant();
  }, []); // Run once on mount

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: '#0f172a' }}>
        <div className="text-white">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="h-screen" style={{ backgroundColor: '#0f172a' }}>
      <ChatInterface
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
        onShowSettings={() => {}}
        autoExpandTools={true}
        showRawParameters={false}
        autoScrollToBottom={true}
        sendByCtrlEnter={false}
        onShowAllTasks={() => {}}
      />
    </div>
  );
};
