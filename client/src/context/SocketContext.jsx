import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import appConfig from '../config/appConfig.js';
import { tokenStorage } from '../services/api.js';
import { useAuth } from '../hooks/useAuth.js';

export const SocketContext = createContext(null);

/**
 * Owns the single Socket.IO connection for the session.
 *
 * The connection is authenticated with the same JWT the REST API uses, is
 * created only once the user is signed in, and is torn down on logout.
 */
export function SocketProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | reconnecting | error

  useEffect(() => {
    if (!isAuthenticated) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setStatus('idle');
      return undefined;
    }

    setStatus('connecting');

    const instance = io(appConfig.socketUrl, {
      auth: { token: tokenStorage.get() },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });

    instance.on('connect', () => setStatus('connected'));
    instance.on('disconnect', () => setStatus('reconnecting'));
    instance.io.on('reconnect_attempt', () => setStatus('reconnecting'));
    instance.on('connect_error', () => setStatus('error'));

    socketRef.current = instance;
    setSocket(instance);

    return () => {
      instance.removeAllListeners();
      instance.disconnect();
      socketRef.current = null;
    };
    // user._id keeps the socket identity in step if the account ever changes.
  }, [isAuthenticated, user?._id]);

  /**
   * Subscribe helper that always unsubscribes the exact handler it added, so
   * components can register listeners inside useEffect without leaking.
   */
  const subscribe = useCallback(
    (event, handler) => {
      if (!socket) return () => {};
      socket.on(event, handler);
      return () => socket.off(event, handler);
    },
    [socket],
  );

  const emit = useCallback(
    (event, payload, ack) => {
      if (!socket?.connected) return false;
      socket.emit(event, payload, ack);
      return true;
    },
    [socket],
  );

  const value = useMemo(
    () => ({
      socket,
      status,
      isConnected: status === 'connected',
      subscribe,
      emit,
    }),
    [socket, status, subscribe, emit],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
