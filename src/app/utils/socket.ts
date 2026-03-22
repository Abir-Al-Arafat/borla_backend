import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from 'app/config';

type IJwtSocketPayload = {
  userId: string;
  role: string;
};

let io: Server | null = null;

const getSocketToken = (socket: any): string | null => {
  const authToken = socket?.handshake?.auth?.token;
  const headerToken = socket?.handshake?.headers?.authorization;

  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim().replace(/^Bearer\s+/i, '');
  }

  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim().replace(/^Bearer\s+/i, '');
  }

  return null;
};

export const initializeSocket = (server: HttpServer) => {
  if (io) return io;

  io = new Server(server, {
    cors: {
      origin: config.client_Url || '*',
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = getSocketToken(socket);
      if (!token) {
        return next(new Error('Unauthorized socket connection'));
      }

      const decoded = jwt.verify(
        token,
        config.jwt_access_secret as string,
      ) as IJwtSocketPayload;

      socket.user = {
        _id: decoded.userId,
        email: '',
        role: decoded.role,
      };

      return next();
    } catch (_error) {
      return next(new Error('Unauthorized socket connection'));
    }
  });

  io.on('connection', socket => {
    const userId = String(socket.user?._id || '');
    console.log(`User connected to socket: ${userId}`);
    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on('chat:join', (chatId: string) => {
      if (chatId) {
        socket.join(`chat:${chatId}`);
        console.log(`User ${userId} joined chat ${chatId}`);
        console.log(`typeof ${typeof chatId}`);
      }
    });

    socket.on('chat:leave', (chatId: string) => {
      if (chatId) {
        socket.leave(`chat:${chatId}`);
      }
    });

    socket.on(
      'chat:typing',
      (payload: { chatId: string; isTyping: boolean }) => {
        if (!payload?.chatId) return;

        socket.to(`chat:${payload.chatId}`).emit('chat:typing', {
          chatId: payload.chatId,
          userId,
          isTyping: !!payload.isTyping,
        });
        console.log(
          `User ${userId} is ${payload.isTyping ? 'typing...' : 'stopped typing.'} in chat ${payload.chatId}`,
        );
      },
    );
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket server has not been initialized');
  }

  return io;
};

export const emitToUser = (
  userId: string,
  event: string,
  payload: Record<string, unknown>,
) => {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
};

export const emitToChat = (
  chatId: string,
  event: string,
  payload: Record<string, unknown>,
) => {
  if (!io || !chatId) return;
  io.to(`chat:${chatId}`).emit(event, payload);
};
