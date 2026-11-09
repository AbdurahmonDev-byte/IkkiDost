'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { RtEvent } from '@ikki-dost/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { SOCKET_URL, useAuth } from './api';

/** Subscribes to the kitchen realtime channel; invalidates order queries on events. */
export function useRealtime(enabled: boolean, onNewOrder?: () => void) {
  const qc = useQueryClient();
  const token = useAuth((s) => s.accessToken);
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const onNewOrderRef = useRef(onNewOrder);
  onNewOrderRef.current = onNewOrder;

  useEffect(() => {
    if (!enabled || !token) return;
    const socket = io(`${SOCKET_URL}/rt`, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    const refresh = () => {
      void qc.invalidateQueries({ queryKey: ['kitchen-orders'] });
    };
    socket.on(RtEvent.ORDER_CREATED, () => {
      refresh();
      onNewOrderRef.current?.();
    });
    for (const evt of [
      RtEvent.ORDER_UPDATED,
      RtEvent.ORDER_CANCELLED,
      RtEvent.ITEM_PREPARING,
      RtEvent.ITEM_READY,
      RtEvent.ITEM_SERVED,
      RtEvent.ORDER_READY,
      'notification:new',
    ]) {
      socket.on(evt, refresh);
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, token, qc]);

  return { connected };
}
