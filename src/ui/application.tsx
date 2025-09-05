import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ChatDemoNew } from './ChatDemoNew';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ChatDemoNew />
    </ErrorBoundary>
  );
};

export default App;
