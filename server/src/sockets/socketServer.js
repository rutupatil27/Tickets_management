import { Server } from 'socket.io';
import { User } from '../models/User.js';
import { isAllowedOrigin } from '../config/env.js';
import { ERROR_CODES, SOCKET_EVENTS } from '../config/constants.js';
import { verifyToken } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import { roleRoom, setIO, userRoom } from './realtime.js';
import { registerTicketHandlers } from './ticketSocket.js';

/**
 * Socket.IO handshake authentication (spec §49).
 * Anonymous connections are rejected outright - a socket can never reach a
 * ticket room without a verified user attached to it.
 */
async function authenticateSocket(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer /i, '');

    if (!token) {
      return next(new Error('Authentication token is missing'));
    }

    const payload = verifyToken(token);
    const user = await User.findById(payload.userId).select('name email role avatar isActive availabilityStatus');

    if (!user) return next(new Error('Account no longer exists'));
    if (!user.isActive) return next(new Error('Account is deactivated'));

    // Everything downstream reads identity from here, never from the payload
    // the client sends with an event.
    socket.user = user;
    return next();
  } catch (error) {
    logger.warn('Socket auth rejected:', error.message);
    return next(new Error('Invalid or expired token'));
  }
}

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      // Same rule as the REST layer, so the socket handshake never fails for an
      // origin the API would have accepted.
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const { user } = socket;

    // Personal room for direct notifications, role room for broadcast fan-out.
    socket.join(userRoom(user._id));
    socket.join(roleRoom(user.role));

    // Listeners MUST be attached synchronously, before anything is awaited.
    // Socket.IO drops an incoming event that has no listener yet, so a client
    // emitting `ticket:join` the instant it connects would otherwise be
    // silently ignored and never receive its ack.
    registerTicketHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      logger.debug(`Socket disconnected: ${user.email} (${reason})`);
      // Presence is *not* business availability (spec §27): we only record a
      // last-seen timestamp and never flip availabilityStatus here.
      User.updateOne({ _id: user._id }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
    });

    logger.debug(`Socket connected: ${user.email} (${socket.id})`);

    socket.emit('connection:ready', {
      userId: user._id.toString(),
      role: user.role,
      serverTime: new Date().toISOString(),
    });

    // Fire-and-forget: presence bookkeeping must never delay handler setup.
    User.updateOne({ _id: user._id }, { $set: { lastSeenAt: new Date() } }).catch((error) =>
      logger.warn('Failed to update lastSeenAt:', error.message),
    );

    socket.on('error', (error) => {
      logger.error('Socket error:', error?.message);
      socket.emit(SOCKET_EVENTS.SOCKET_ERROR, {
        message: 'Socket error',
        errorCode: ERROR_CODES.INTERNAL_ERROR,
      });
    });
  });

  setIO(io);
  logger.info('Socket.IO server ready');

  return io;
}
