import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import Application from './application';
import { WebSocketProvider } from './contexts/WebSocketContext';
import './entry.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <WebSocketProvider>
        <Application />
      </WebSocketProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
