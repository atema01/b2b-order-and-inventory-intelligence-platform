
import React, { createContext, useContext, useEffect } from 'react';
import { socket } from '../services/mockWebSocket';

interface WebSocketContextType {
  socket: typeof socket;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // Connect on mount
    socket.connect();

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ socket }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
