import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatDemo } from './ChatDemo';
import './entry.css'; // Import Tailwind styles

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ChatDemo />
    </React.StrictMode>
  );
}