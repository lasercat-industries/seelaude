import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ChatDemoNew } from './ChatDemoNew';
import { WebSocketProvider } from './contexts/WebSocketContext';

const App: React.FC = () => {
  return (
    <WebSocketProvider>
      <ErrorBoundary>
        <ChatDemoNew />
      </ErrorBoundary>
    </WebSocketProvider>
  );
};

export default App;
