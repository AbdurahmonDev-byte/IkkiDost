import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL, useAuth } from './api';

import { RtEvent } from '@ikki-dost/shared-types';

const EVENTS = Object.values(RtEvent);

/** Notifies the caller when any realtime money/order event arrives. */
export function useRealtime(onChange: () => void) {
  const token = useAuth((s) => s.accessToken);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;
    const socket = io(`${SOCKET_URL}/rt`, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    for (const e of EVENTS) socket.on(e, onChange);
    return () => {
      socket.disconnect();
    };
  }, [token, onChange]);

  return { connected };
}
