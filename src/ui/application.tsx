import React, { useState } from 'react';
import { Button } from './components/Button';
import { ErrorBoundary } from './components/ErrorBoundary';
import { api, APIError } from './api/client';

const App: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);

  const handleClick = async () => {
    try {
      const response = await api.check();
      await response.json();
      setMessage('get worked');
    } catch (error) {
      if (error instanceof APIError) {
        setMessage(`Error (${error.status}): ${error.message}`);
      } else {
        setMessage('An unexpected error occurred');
      }
    }
  };

  return (
    <ErrorBoundary>
      <main className="space-y-8 my-8 mx-auto max-w-2xl px-4 md:px-0">
        <div className="p-4 bg-slate-100 rounded-lg shadow-md">
          <Button onClick={handleClick}>Check the Protected API</Button>
          {message && (
            <div className="bg-slate-200 flex-col md:flex-row p-4 mt-4 rounded-lg flex items-center justify-between gap-4">
              <p>{message}</p>
              <Button variant="secondary" onClick={() => setMessage(null)}>
                Clear
              </Button>
            </div>
          )}
        </div>
      </main>
    </ErrorBoundary>
  );
};

export default App;
