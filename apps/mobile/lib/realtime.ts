import { RtEvent } from '@ikki-dost/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from './api';
import { useAuth } from './auth';
import { toast } from '../components/toast';

let socket: Socket | null = null;
let socketToken: string | null = null;

/** Reuse one socket per access token; reconnect when the token changes. */
export function getSocket(token: string): Socket {
  if (socket && socketToken === token) {
    if (!socket.connected) socket.connect();
    return socket;
  }
  disconnectRealtime();
  socketToken = token;
  socket = io(`${SOCKET_URL}/rt`, {
    transports: ['websocket'],
    auth: { token },
    reconnection: true,
    reconnectionDelayMax: 8000,
  });
  return socket;
}

export function disconnectRealtime(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  socketToken = null;
}

const REALTIME_EVENTS = Object.values(RtEvent);

/**
 * Subscribe the signed-in user to realtime updates. Every domain event
 * invalidates cached queries so screens refresh themselves; new notifications
 * also surface as a toast.
 */
export function useRealtime(enabled = true): void {
  const token = useAuth((s) => s.accessToken);
  const role = useAuth((s) => s.user?.role);
  const queryClient = useQueryClient();
  const roleRef = useRef(role);
  roleRef.current = role;

  useEffect(() => {
    if (!enabled || !token) return;
    const s = getSocket(token);

    const invalidate = () => {
      void queryClient.invalidateQueries();
    };
    const onNotification = (payload: { title?: string; body?: string } | undefined) => {
      invalidate();
      if (payload?.title) toast.info(payload.title, payload.body);
    };

    for (const event of REALTIME_EVENTS) s.on(event, invalidate);
    s.on('notification:new', onNotification);
    s.on('connect', invalidate);

    return () => {
      for (const event of REALTIME_EVENTS) s.off(event, invalidate);
      s.off('notification:new', onNotification);
      s.off('connect', invalidate);
    };
  }, [enabled, token, queryClient]);

  // Drop the socket when the session ends.
  useEffect(() => {
    if (!token) disconnectRealtime();
  }, [token]);
}
