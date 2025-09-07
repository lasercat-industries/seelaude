import React, { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import { useWebSocketContext } from './contexts/WebSocketContext';

export const ChatDemo: React.FC = () => {
  const [selectedProject] = useState({
    name: '-Users-rylandgoldstein-repos-perlox',
    path: '/Users/rylandgoldstein/repos/perlox',
    fullPath: '/Users/rylandgoldstein/repos/perlox',
    displayName: 'Perlox Demo',
    sessions: [],
  });

  // const [selectedSession] = useState({
  //   id: '0388ce60-feac-4f7d-a122-2240e8beab59',
  //   summary: 'spec approved, please proceed',
  //   lastActivity: '2025-08-27T20:10:21.222Z',
  //   messageCount: 259,
  //   created: '2025-08-27T18:03:26.608Z',
  // });

  // const [selectedProject] = useState();

  const [selectedSession] = useState();

  const { ws, sendMessage, messages: wMessages } = useWebSocketContext();

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
