import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';

type SocketAuthPayload = {
  userId: string;
  role: string;
};

export type NotificationRealtimePayload = {
  action: 'created' | 'updated' | 'deleted' | 'read-all';
  notificationId?: string;
  notification?: any;
};

export type OrderRealtimePayload = {
  action: 'created' | 'updated' | 'status-updated';
  orderId: string;
  buyerId?: string;
  status?: string;
};

export type PaymentRealtimePayload = {
  action: 'created' | 'updated';
  paymentId: string;
  orderId: string;
  buyerId: string;
  creditRequestId?: string;
  status?: string;
};

export type CreditRealtimePayload = {
  action: 'created' | 'updated' | 'repaid';
  creditRequestId: string;
  buyerId: string;
  orderId?: string;
  status?: string;
};

export type InventoryRealtimePayload = {
  productId: string;
  status?: string;
  stock?: {
    mainWarehouse: number;
    backRoom: number;
    showRoom: number;
    total: number;
  };
};

const AUTHENTICATED_ROOM = 'auth:all';
const SELLER_ROOM = 'role:seller';
const getUserRoom = (userId: string) => `user:${userId}`;
const getRecipientRoom = (recipientId: string) => `recipient:${recipientId}`;

let io: Server | null = null;

const getTokenFromCookieHeader = (cookieHeader?: string) => {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [name, ...rest] = part.trim().split('=');
    if (name === 'token') {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
};

const attachUserRooms = (socket: Socket, user: SocketAuthPayload) => {
  socket.join(AUTHENTICATED_ROOM);
  socket.join(getUserRoom(user.userId));

  if (user.role === 'R-BUYER') {
    socket.join(getRecipientRoom(user.userId));
  } else {
    socket.join(SELLER_ROOM);
    socket.join(getRecipientRoom('seller'));
  }
};

export const initializeRealtime = (httpServer: HttpServer, allowedOrigins: string[]) => {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : true,
      credentials: true
    }
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        getTokenFromCookieHeader(socket.handshake.headers.cookie);

      if (!token) {
        return next(new Error('Unauthorized'));
      }

      if (!process.env.JWT_SECRET) {
        return next(new Error('JWT secret missing'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET) as SocketAuthPayload;
      (socket.data as any).user = decoded;
      attachUserRooms(socket, decoded);
      next();
    } catch (error) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.emit('socket:ready', { connectedAt: new Date().toISOString() });
  });

  return io;
};

const emitToRecipients = (eventName: string, buyerId: string | undefined, payload: any) => {
  if (!io) return;
  io.to(SELLER_ROOM).emit(eventName, payload);
  if (buyerId) {
    io.to(getUserRoom(buyerId)).emit(eventName, payload);
  }
};

export const emitNotificationChanged = (
  recipientId: string,
  payload: NotificationRealtimePayload
) => {
  if (!io) return;
  io.to(getRecipientRoom(recipientId)).emit('notifications:changed', payload);
};

export const emitOrderChanged = (payload: OrderRealtimePayload) => {
  emitToRecipients('orders:changed', payload.buyerId, payload);
};

export const emitPaymentChanged = (payload: PaymentRealtimePayload) => {
  emitToRecipients('payments:changed', payload.buyerId, payload);
};

export const emitCreditChanged = (payload: CreditRealtimePayload) => {
  emitToRecipients('credits:changed', payload.buyerId, payload);
};

export const emitInventoryChanged = (payload: InventoryRealtimePayload) => {
  if (!io) return;
  io.to(AUTHENTICATED_ROOM).emit('inventory:changed', payload);
};
