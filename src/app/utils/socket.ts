import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from 'app/config';

type IJwtSocketPayload = {
  userId: string;
  role: string;
};

let io: Server | null = null;

const emitOperationSuccess = (
  socket: Parameters<Server['on']>[1] extends (arg: infer S) => any ? S : any,
  event: string,
  payload: Record<string, unknown>,
) => {
  socket.emit(`${event}:success`, {
    success: true,
    ...payload,
  });
};

const emitOperationFailure = (
  socket: Parameters<Server['on']>[1] extends (arg: infer S) => any ? S : any,
  event: string,
  message: string,
  payload: Record<string, unknown> = {},
) => {
  socket.emit(`${event}:failure`, {
    success: false,
    message,
    ...payload,
  });
};

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
      emitOperationSuccess(socket, 'socket:connection', {
        userId,
      });
    }

    socket.on('chat:join', (chatId: string) => {
      try {
        if (!chatId || !String(chatId).trim()) {
          emitOperationFailure(socket, 'chat:join', 'chatId is required');
          return;
        }

        socket.join(`chat:${chatId}`);

        console.log(`User ${userId} joined chat ${chatId}`);
        console.log(`typeof ${typeof chatId}`);

        emitOperationSuccess(socket, 'chat:join', {
          chatId,
          userId,
        });
      } catch (_error) {
        emitOperationFailure(socket, 'chat:join', 'Failed to join chat room', {
          chatId,
        });
      }
    });

    socket.on('chat:leave', (chatId: string) => {
      try {
        if (!chatId || !String(chatId).trim()) {
          emitOperationFailure(socket, 'chat:leave', 'chatId is required');
          return;
        }

        socket.leave(`chat:${chatId}`);
        emitOperationSuccess(socket, 'chat:leave', {
          chatId,
          userId,
        });
      } catch (_error) {
        emitOperationFailure(
          socket,
          'chat:leave',
          'Failed to leave chat room',
          { chatId },
        );
      }
    });

    socket.on(
      'chat:typing',
      (payload: { chatId: string; isTyping: boolean }) => {
        try {
          if (!payload?.chatId || !String(payload.chatId).trim()) {
            emitOperationFailure(socket, 'chat:typing', 'chatId is required');
            return;
          }

          socket.to(`chat:${payload.chatId}`).emit('chat:typing', {
            chatId: payload.chatId,
            userId,
            isTyping: !!payload.isTyping,
          });
          console.log(
            `User ${userId} is ${payload.isTyping ? 'typing...' : 'stopped typing.'} in chat ${payload.chatId}`,
          );

          emitOperationSuccess(socket, 'chat:typing', {
            chatId: payload.chatId,
            userId,
            isTyping: !!payload.isTyping,
          });
        } catch (_error) {
          emitOperationFailure(
            socket,
            'chat:typing',
            'Failed to send typing state',
            {
              chatId: payload?.chatId || null,
            },
          );
        }
      },
    );

    socket.on('disconnect', reason => {
      console.log(
        `User disconnected from socket: ${userId}, reason: ${reason}`,
      );
      emitOperationSuccess(socket, 'socket:disconnect', {
        userId,
        reason,
      });
    });
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
