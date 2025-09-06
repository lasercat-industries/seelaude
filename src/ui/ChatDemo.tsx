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
  // const [selectedSession, setSelectedSession] = useState({
  //   id: 'cd5c1ea3-a0da-45ad-ac12-fa5c51f5e913',
  //   title:
  //     '# /setup\n\nCreate the boilerplate infrastructure for claude code in this project\n\n## Rules\n\nNever add...',
  //   created: '2025-08-27T17:26:08.998Z',
  //   lastActivity: '2025-08-27T17:30:38.469Z',
  // });
  const [selectedSession] = useState({
    id: 'f0fc8e47-cb29-41a2-bf56-28cbdd1d0483',
    summary: 'spec approved, please proceed',
    lastActivity: '2025-08-27T20:10:21.222Z',
    messageCount: 259,
    created: '2025-08-27T18:03:26.608Z',
  });

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
