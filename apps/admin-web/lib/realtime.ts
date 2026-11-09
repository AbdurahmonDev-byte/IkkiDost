'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { SOCKET_URL, useAuth } from './api';

import { RtEvent } from '@ikki-dost/shared-types';

const EVENTS = [...Object.values(RtEvent), 'notification:new'];

/** Subscribes the admin app to all realtime events and refreshes queries. */
export function useRealtime() {
  const qc = useQueryClient();
  const token = useAuth((s) => s.accessToken);
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;
    const socket = io(`${SOCKET_URL}/rt`, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    const refresh = () => void qc.invalidateQueries();
    for (const e of EVENTS) socket.on(e, refresh);
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, qc]);

  return { connected };
}
