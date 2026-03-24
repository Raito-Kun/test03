import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from './jwt';
import logger from './logger';

let io: SocketIOServer | null = null;

export function initSocketIO(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // JWT auth middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = verifyAccessToken(token);
      (socket as SocketWithUser).data.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as SocketWithUser).data.user;
    if (!user) {
      socket.disconnect();
      return;
    }

    // Join personal room
    socket.join(`user:${user.userId}`);

    // Join team room if applicable
    if (user.teamId) {
      socket.join(`team:${user.teamId}`);
    }

    logger.info('Socket.IO client connected', { userId: user.userId, socketId: socket.id });

    socket.on('disconnect', () => {
      logger.info('Socket.IO client disconnected', { userId: user.userId, socketId: socket.id });
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

/** Emit to a specific user room */
export function emitToUser(userId: string, event: string, data: unknown): void {
  io?.to(`user:${userId}`).emit(event, data);
}

/** Emit to a team room */
export function emitToTeam(teamId: string, event: string, data: unknown): void {
  io?.to(`team:${teamId}`).emit(event, data);
}

interface SocketWithUser extends Socket {
  data: {
    user?: { userId: string; role: string; teamId: string | null };
  };
}
