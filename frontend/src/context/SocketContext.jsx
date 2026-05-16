import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext({ 
  socket: null, 
  connected: false,
  backupProgress: null,
  restoreProgress: null
});

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [backupProgress, setBackupProgress] = useState(null);
  const [restoreProgress, setRestoreProgress] = useState(null);

  useEffect(() => {
    const url = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:5000');

    const s = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      timeout: 10000,
    });

    s.on('connect',       () => setConnected(true));
    s.on('disconnect',    () => setConnected(false));
    s.on('backup_progress', data => {
      setBackupProgress(data);
      if (data.status === 'complete' || data.status === 'error') {
        setTimeout(() => setBackupProgress(null), 5000);
      }
    });
    s.on('restore_progress', data => {
      setRestoreProgress(data);
      if (data.percent === 100 || data.status === 'error') {
        setTimeout(() => setRestoreProgress(null), 5000);
      }
    });

    setSocket(s);
    return () => { try { s.disconnect(); } catch {} };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected, backupProgress, restoreProgress }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
