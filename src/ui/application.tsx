import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ChatDemo } from './ChatDemo';
import { WebSocketProvider } from './contexts/WebSocketContext';

const App: React.FC = () => {
  return (
    <WebSocketProvider>
      <ErrorBoundary>
        <ChatDemo />
      </ErrorBoundary>
    </WebSocketProvider>
  );
};

export default App;
