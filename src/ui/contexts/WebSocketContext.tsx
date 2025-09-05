import React, { createContext, useContext, type FC, type ReactNode } from 'react';
import type { WebSocket, WebSocketMessage, OutgoingMessage } from '@shared/types';
import { useWebSocket } from '../utils/websocket';

const WebSocketContext = createContext<{
  ws?: WebSocket;
  sendMessage: (message: OutgoingMessage) => void;
  messages: WebSocketMessage[];
  isConnected: boolean;
}>({
  ws: undefined,
  sendMessage: () => {},
  messages: [],
  isConnected: false
});

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider:  FC<{ children?: ReactNode }> = ({ children }) => {
  const webSocketData = useWebSocket();
  
  return (
    <WebSocketContext.Provider value={webSocketData}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketContext;