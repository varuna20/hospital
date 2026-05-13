import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext({ socket: null, connected: false });

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Connect to same host in production, localhost:5000 in dev
    const url = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:5000');

    const s = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    s.on('connect',       () => setConnected(true));
    s.on('disconnect',    () => setConnected(false));
    s.on('connect_error', (err) => {
      // Don't crash - app still works without real-time
      console.warn('Socket offline (real-time disabled):', err.message);
      setConnected(false);
    });

    setSocket(s);

    return () => {
      try { s.disconnect(); } catch {}
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
