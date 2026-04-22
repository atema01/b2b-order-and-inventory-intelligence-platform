import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const dispatchRealtimeEvent = (eventName: string, detail: any) => {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
};

export const connectRealtime = () => {
  if (socket) return socket;

  socket = io('/', {
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling']
  });

  socket.on('notifications:changed', (payload) => dispatchRealtimeEvent('realtime:notifications', payload));
  socket.on('orders:changed', (payload) => dispatchRealtimeEvent('realtime:orders', payload));
  socket.on('payments:changed', (payload) => dispatchRealtimeEvent('realtime:payments', payload));
  socket.on('credits:changed', (payload) => dispatchRealtimeEvent('realtime:credits', payload));
  socket.on('inventory:changed', (payload) => dispatchRealtimeEvent('realtime:inventory', payload));

  return socket;
};

export const disconnectRealtime = () => {
  if (!socket) return;
  socket.disconnect();
  socket = null;
};
