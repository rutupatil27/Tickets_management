import { ticketRoom } from '../models/Ticket.js';

/**
 * Thin indirection around the Socket.IO server instance.
 *
 * Services import *this* module rather than the socket server itself, which
 * keeps the dependency graph acyclic (services -> realtime <- socketServer)
 * and lets every service emit without knowing how sockets are wired up.
 */
let io = null;

export const setIO = (instance) => {
  io = instance;
};

export const getIO = () => io;

export const userRoom = (userId) => `user:${userId.toString()}`;
export const roleRoom = (role) => `role:${role}`;
export { ticketRoom };

export function emitToTicket(ticketId, event, payload) {
  io?.to(ticketRoom(ticketId)).emit(event, payload);
}

export function emitToUser(userId, event, payload) {
  if (!userId) return;
  io?.to(userRoom(userId)).emit(event, payload);
}

export function emitToUsers(userIds = [], event, payload) {
  userIds.filter(Boolean).forEach((userId) => emitToUser(userId, event, payload));
}

export function emitToRole(role, event, payload) {
  io?.to(roleRoom(role)).emit(event, payload);
}

/** How many sockets a given user currently has open. */
export async function socketsForUser(userId) {
  if (!io) return 0;
  const sockets = await io.in(userRoom(userId)).fetchSockets();
  return sockets.length;
}
