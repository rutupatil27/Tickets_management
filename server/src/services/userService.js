import { User } from '../models/User.js';
import { Ticket } from '../models/Ticket.js';
import {
  AVAILABILITY,
  ERROR_CODES,
  ROLES,
  SOCKET_EVENTS,
} from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { buildPaginationMeta, escapeRegex, resolvePagination } from '../utils/pagination.js';
import { emitToRole, emitToUser } from '../sockets/realtime.js';
import { getAgentWorkloads, processWaitingQueue } from './assignmentService.js';
import { logger } from '../utils/logger.js';

const SORT_MAP = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
};

const asArray = (value) => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

export async function listUsers(query = {}) {
  const { page, limit, skip } = resolvePagination(query);

  const filter = {};
  const roles = asArray(query.role);
  if (roles.length) filter.role = { $in: roles };
  if (query.availabilityStatus) filter.availabilityStatus = query.availabilityStatus;
  if (query.isActive === 'true') filter.isActive = true;
  if (query.isActive === 'false') filter.isActive = false;

  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort(SORT_MAP[query.sort] ?? SORT_MAP.newest).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  // Agents in the list carry their live workload so the admin table is useful.
  const agentIds = users.filter((user) => user.role === ROLES.AGENT).map((user) => user._id);
  const workloads = await getAgentWorkloads(agentIds);

  return {
    users: users.map((user) => ({
      ...user,
      passwordHash: undefined,
      activeTickets: user.role === ROLES.AGENT ? workloads.get(user._id.toString()) ?? 0 : undefined,
    })),
    pagination: buildPaginationMeta({ page, limit, total }),
  };
}

export async function getUserById(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);

  const [createdCount, assignedCount] = await Promise.all([
    Ticket.countDocuments({ createdBy: user._id }),
    Ticket.countDocuments({ assignedTo: user._id }),
  ]);

  return { ...user, stats: { createdTickets: createdCount, assignedTickets: assignedCount } };
}

/** The only account type an admin can create. Customers register themselves. */
export async function createAgent({ payload }) {
  const existing = await User.findOne({ email: payload.email });
  if (existing) throw ApiError.conflict('Email is already registered', ERROR_CODES.EMAIL_IN_USE);

  const passwordHash = await User.hashPassword(payload.password);

  const user = await User.create({
    name: payload.name,
    email: payload.email,
    passwordHash,
    role: ROLES.AGENT,
    skills: payload.skills ?? [],
    // Starts offline so a brand-new agent is not handed tickets before they log in.
    availabilityStatus: AVAILABILITY.OFFLINE,
  });

  return user.toJSON();
}

export async function updateUserProfile({ actor, userId, payload }) {
  const isSelf = actor._id.toString() === userId.toString();
  if (!isSelf && actor.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('You can only update your own profile');
  }

  const user = await User.findByIdAndUpdate(userId, { $set: payload }, { new: true, runValidators: true });
  if (!user) throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);

  return user.toJSON();
}

export async function updateUserRole({ admin, userId, role }) {
  if (admin._id.toString() === userId.toString()) {
    throw ApiError.badRequest('You cannot change your own role');
  }

  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);

  if (user.role === role) throw ApiError.badRequest(`User is already a ${role}`);

  // Someone leaving the agent role must not keep active tickets behind.
  if (user.role === ROLES.AGENT && role !== ROLES.AGENT) {
    const activeCount = await Ticket.countDocuments({
      assignedTo: user._id,
      status: { $in: ['ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'REOPENED'] },
    });
    if (activeCount > 0) {
      throw ApiError.badRequest(
        `This agent still has ${activeCount} active ticket(s). Reassign them before changing the role.`,
      );
    }
  }

  user.role = role;
  if (role !== ROLES.AGENT) user.availabilityStatus = AVAILABILITY.OFFLINE;
  await user.save();

  emitToUser(user._id, SOCKET_EVENTS.PRESENCE_UPDATE, { user: user.toJSON() });
  emitToRole(ROLES.ADMIN, SOCKET_EVENTS.PRESENCE_UPDATE, { user: user.toJSON() });

  return user.toJSON();
}

/**
 * Deactivating an agent does NOT reassign their open tickets (spec §56) -
 * existing work stays put and the admin decides what to move.
 */
export async function updateUserActiveStatus({ admin, userId, isActive }) {
  if (admin._id.toString() === userId.toString()) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }

  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);

  user.isActive = isActive;
  if (!isActive) user.availabilityStatus = AVAILABILITY.OFFLINE;
  await user.save();

  emitToRole(ROLES.ADMIN, SOCKET_EVENTS.PRESENCE_UPDATE, { user: user.toJSON() });

  if (isActive && user.role === ROLES.AGENT && user.availabilityStatus === AVAILABILITY.AVAILABLE) {
    processWaitingQueue().catch((error) => logger.error('Queue drain failed:', error.message));
  }

  return user.toJSON();
}

/**
 * Availability change (spec §16 / §77).
 * Flipping to AVAILABLE immediately drains the waiting queue.
 */
export async function updateAvailability({ actor, userId, availabilityStatus }) {
  const isSelf = actor._id.toString() === userId.toString();
  if (!isSelf && actor.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('You can only change your own availability');
  }

  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);

  if (user.role !== ROLES.AGENT) {
    throw ApiError.badRequest('Only support agents have an availability status');
  }

  const previous = user.availabilityStatus;
  user.availabilityStatus = availabilityStatus;
  user.lastSeenAt = new Date();
  await user.save();

  const payload = { user: user.toJSON(), previous };
  emitToUser(user._id, SOCKET_EVENTS.PRESENCE_UPDATE, payload);
  emitToRole(ROLES.ADMIN, SOCKET_EVENTS.PRESENCE_UPDATE, payload);

  let queued = 0;
  if (availabilityStatus === AVAILABILITY.AVAILABLE && previous !== AVAILABILITY.AVAILABLE && user.isActive) {
    const result = await processWaitingQueue();
    queued = result.assigned;
  }

  return { user: user.toJSON(), assignedFromQueue: queued };
}

/** Agent picker for the admin reassign dialog. */
export async function listAssignableAgents() {
  const agents = await User.find({ role: ROLES.AGENT, isActive: true })
    .select('name email avatar availabilityStatus skills')
    .sort({ name: 1 })
    .lean();

  const workloads = await getAgentWorkloads(agents.map((agent) => agent._id));

  return agents
    .map((agent) => ({ ...agent, activeTickets: workloads.get(agent._id.toString()) ?? 0 }))
    .sort((a, b) => a.activeTickets - b.activeTickets || a.name.localeCompare(b.name));
}

export async function touchLastSeen(userId) {
  await User.updateOne({ _id: userId }, { $set: { lastSeenAt: new Date() } });
}
