import { Ticket } from '../models/Ticket.js';
import { User } from '../models/User.js';
import { AssignmentHistory } from '../models/AssignmentHistory.js';
import {
  ACTIVE_TICKET_STATUSES,
  ASSIGNED_BY_TYPE,
  ASSIGNMENT_REASON,
  AVAILABILITY,
  ERROR_CODES,
  NOTIFICATION_TYPE,
  ROLES,
  SOCKET_EVENTS,
  TICKET_STATUS,
  UNASSIGNED_STATUSES,
} from '../config/constants.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { emitToRole, emitToTicket, emitToUser } from '../sockets/realtime.js';
import { createNotification } from './notificationService.js';
import { createSystemMessage } from './messageService.js';

const AGENT_FIELDS = 'name email role avatar availabilityStatus skills isActive';

/* -------------------------------------------------------------------------- */
/* Workload                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Active ticket count per agent (spec §54).
 * RESOLVED and CLOSED tickets never count towards workload.
 */
export async function getAgentWorkloads(agentIds = []) {
  const map = new Map(agentIds.map((id) => [id.toString(), 0]));
  if (!agentIds.length) return map;

  const rows = await Ticket.aggregate([
    {
      $match: {
        assignedTo: { $in: agentIds },
        status: { $in: ACTIVE_TICKET_STATUSES },
      },
    },
    { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
  ]);

  rows.forEach((row) => map.set(row._id.toString(), row.count));
  return map;
}

/** Agents eligible for *automatic* assignment (spec §14). */
export async function findEligibleAgents() {
  return User.find({
    role: ROLES.AGENT,
    isActive: true,
    availabilityStatus: AVAILABILITY.AVAILABLE,
  })
    .select(AGENT_FIELDS)
    .lean();
}

/**
 * Core of the engine: pick the least-loaded eligible agent.
 *
 * Ordering:
 *   1. fewest active tickets
 *   2. name (deterministic tie-break so the behaviour is reproducible/testable)
 *
 * When ENABLE_SKILL_BASED_ROUTING is on, agents whose `skills` include the
 * ticket category are preferred; if none match we fall back to the whole pool.
 * This is the extension point described in spec §18 - it is off by default so
 * the MVP behaves exactly as §14/§76 describe.
 */
export async function selectBestAgent({ category } = {}) {
  const agents = await findEligibleAgents();
  if (!agents.length) return null;

  const workloads = await getAgentWorkloads(agents.map((agent) => agent._id));

  const withLoad = agents.map((agent) => ({
    agent,
    activeTickets: workloads.get(agent._id.toString()) ?? 0,
  }));

  const cap = env.AGENT_MAX_ACTIVE_TICKETS;
  const withCapacity = cap > 0 ? withLoad.filter((row) => row.activeTickets < cap) : withLoad;
  if (!withCapacity.length) return null;

  let pool = withCapacity;
  let reason = ASSIGNMENT_REASON.LEAST_LOADED_AGENT;

  if (env.ENABLE_SKILL_BASED_ROUTING && category) {
    const skilled = withCapacity.filter((row) => row.agent.skills?.includes(category));
    if (skilled.length) {
      pool = skilled;
      reason = ASSIGNMENT_REASON.SKILL_MATCH_LEAST_LOADED;
    }
  }

  const sorted = [...pool].sort(
    (a, b) => a.activeTickets - b.activeTickets || a.agent.name.localeCompare(b.agent.name),
  );

  return {
    agent: sorted[0].agent,
    reason,
    workloadSnapshot: withLoad.map((row) => ({
      agent: row.agent._id,
      activeTickets: row.activeTickets,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Applying an assignment                                                     */
/* -------------------------------------------------------------------------- */

/** Statuses that should be reset to ASSIGNED when a new agent takes over. */
const RESETTABLE = [
  TICKET_STATUS.OPEN,
  TICKET_STATUS.WAITING_FOR_AGENT,
  TICKET_STATUS.ASSIGNED,
  TICKET_STATUS.IN_PROGRESS,
  TICKET_STATUS.WAITING_FOR_CUSTOMER,
  TICKET_STATUS.REOPENED,
];

/**
 * Persists the assignment, writes the audit trail, posts the system message and
 * fans out the real-time events. `requireUnassigned` makes the DB write atomic
 * so two concurrent drains cannot hand the same ticket to two agents.
 */
async function applyAssignment({
  ticket,
  agent,
  reason,
  workloadSnapshot = [],
  assignedBy = null,
  assignedByType = ASSIGNED_BY_TYPE.SYSTEM,
  note = '',
  requireUnassigned = false,
}) {
  const previousAgent = ticket.assignedTo ? ticket.assignedTo.toString() : null;
  const now = new Date();

  const nextStatus = RESETTABLE.includes(ticket.status) ? TICKET_STATUS.ASSIGNED : ticket.status;

  const filter = { _id: ticket._id };
  if (requireUnassigned) filter.assignedTo = null;

  const updated = await Ticket.findOneAndUpdate(
    filter,
    { $set: { assignedTo: agent._id, status: nextStatus, assignedAt: now } },
    { new: true },
  );

  // Lost the race - another process already claimed this ticket.
  if (!updated) return null;

  await AssignmentHistory.create({
    ticketId: updated._id,
    previousAgent,
    newAgent: agent._id,
    assignedBy,
    assignedByType,
    reason,
    workloadSnapshot,
    note,
  });

  const by = assignedByType === ASSIGNED_BY_TYPE.ADMIN ? 'An administrator' : 'The system';
  await createSystemMessage(
    updated,
    previousAgent
      ? `${by} reassigned this ticket to ${agent.name}.`
      : `${by} assigned this ticket to ${agent.name}.`,
  );

  const populated = await populateTicket(updated._id);

  // Agent gets the "new ticket" notification (spec §29).
  await createNotification({
    userId: agent._id,
    type: previousAgent ? NOTIFICATION_TYPE.TICKET_REASSIGNED : NOTIFICATION_TYPE.TICKET_ASSIGNED,
    title: 'New ticket assigned to you',
    message: `${updated.ticketNumber} - ${updated.subject} (${updated.priority})`,
    ticket: updated,
  });

  // Customer learns who is handling their issue.
  await createNotification({
    userId: updated.createdBy,
    type: NOTIFICATION_TYPE.TICKET_ASSIGNED,
    title: `${updated.ticketNumber} assigned`,
    message: `${agent.name} is now handling your ticket.`,
    ticket: updated,
  });

  emitToUser(agent._id, SOCKET_EVENTS.TICKET_ASSIGNED, { ticket: populated });
  emitToUser(updated.createdBy, SOCKET_EVENTS.TICKET_ASSIGNED, { ticket: populated });
  if (previousAgent) {
    emitToUser(previousAgent, SOCKET_EVENTS.TICKET_UPDATED, { ticket: populated });
  }
  emitToTicket(updated._id, SOCKET_EVENTS.TICKET_UPDATED, { ticket: populated });
  emitToRole(ROLES.ADMIN, SOCKET_EVENTS.TICKET_UPDATED, { ticket: populated });

  logger.info(
    `Ticket ${updated.ticketNumber} -> ${agent.name} (${reason}${previousAgent ? ', reassigned' : ''})`,
  );

  return populated;
}

export function populateTicket(ticketId) {
  return Ticket.findById(ticketId)
    .populate('createdBy', 'name email role avatar')
    .populate('assignedTo', 'name email role avatar availabilityStatus')
    .lean();
}

/* -------------------------------------------------------------------------- */
/* Public entry points                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Runs immediately after a ticket is created (spec §16).
 * Falls back to WAITING_FOR_AGENT when nobody is available.
 */
export async function autoAssignTicket(ticket) {
  const selection = await selectBestAgent({ category: ticket.category });

  if (!selection) {
    const updated = await Ticket.findByIdAndUpdate(
      ticket._id,
      { $set: { status: TICKET_STATUS.WAITING_FOR_AGENT, assignedTo: null } },
      { new: true },
    );

    await AssignmentHistory.create({
      ticketId: ticket._id,
      previousAgent: null,
      newAgent: null,
      assignedByType: ASSIGNED_BY_TYPE.SYSTEM,
      reason: ASSIGNMENT_REASON.NO_AGENT_AVAILABLE,
      note: 'No active agent with AVAILABLE status',
    });

    await createSystemMessage(
      updated,
      'No support agent is available right now. This ticket is queued and will be assigned automatically.',
    );

    const populated = await populateTicket(ticket._id);
    emitToRole(ROLES.ADMIN, SOCKET_EVENTS.TICKET_UPDATED, { ticket: populated });

    logger.warn(`Ticket ${ticket.ticketNumber} queued - no available agent`);
    return { assigned: false, ticket: populated, agent: null };
  }

  const populated = await applyAssignment({
    ticket,
    agent: selection.agent,
    reason: selection.reason,
    workloadSnapshot: selection.workloadSnapshot,
    requireUnassigned: true,
  });

  return { assigned: Boolean(populated), ticket: populated, agent: selection.agent };
}

/* -------------------------------------------------------------------------- */
/* Waiting queue                                                              */
/* -------------------------------------------------------------------------- */

// Simple in-process guard: a drain triggered while one is running is coalesced
// into a single follow-up pass instead of interleaving with it.
let draining = false;
let drainQueuedAgain = false;

/**
 * Assigns queued tickets in priority order (spec §17):
 *   priority DESC, createdAt ASC
 * Called whenever an agent becomes AVAILABLE or is reactivated.
 */
export async function processWaitingQueue({ maxAssignments = 50 } = {}) {
  if (draining) {
    drainQueuedAgain = true;
    return { assigned: 0, skipped: true };
  }

  draining = true;
  let assigned = 0;

  try {
    while (assigned < maxAssignments) {
      const ticket = await Ticket.findOne({
        assignedTo: null,
        status: { $in: UNASSIGNED_STATUSES },
      })
        .sort({ priorityWeight: -1, createdAt: 1 })
        .exec();

      if (!ticket) break;

      const selection = await selectBestAgent({ category: ticket.category });
      if (!selection) break;

      const result = await applyAssignment({
        ticket,
        agent: selection.agent,
        reason: ASSIGNMENT_REASON.QUEUE_DRAIN,
        workloadSnapshot: selection.workloadSnapshot,
        requireUnassigned: true,
      });

      if (result) assigned += 1;
    }
  } catch (error) {
    logger.error('Waiting queue drain failed:', error.message);
  } finally {
    draining = false;
  }

  if (drainQueuedAgain) {
    drainQueuedAgain = false;
    const followUp = await processWaitingQueue({ maxAssignments });
    assigned += followUp.assigned;
  }

  if (assigned > 0) logger.info(`Waiting queue drained: ${assigned} ticket(s) assigned`);
  return { assigned };
}

/** Number of tickets currently sitting in the queue. */
export function countWaitingTickets() {
  return Ticket.countDocuments({ assignedTo: null, status: { $in: UNASSIGNED_STATUSES } });
}

/* -------------------------------------------------------------------------- */
/* Admin override                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Admin reassignment (spec §75 Rule 12).
 * With no agentId the engine re-runs automatic selection instead.
 */
export async function reassignTicket({ ticket, admin, agentId, note = '' }) {
  if (!agentId) {
    const selection = await selectBestAgent({ category: ticket.category });
    if (!selection) {
      throw ApiError.badRequest(
        'No available agent to assign this ticket to',
        ERROR_CODES.AGENT_UNAVAILABLE,
      );
    }

    return applyAssignment({
      ticket,
      agent: selection.agent,
      reason: ASSIGNMENT_REASON.ADMIN_OVERRIDE,
      workloadSnapshot: selection.workloadSnapshot,
      assignedBy: admin._id,
      assignedByType: ASSIGNED_BY_TYPE.ADMIN,
      note: note || 'Admin triggered automatic re-assignment',
    });
  }

  const agent = await User.findById(agentId).select(AGENT_FIELDS);

  if (!agent || agent.role !== ROLES.AGENT) {
    throw ApiError.badRequest('Selected user is not a support agent', ERROR_CODES.VALIDATION_ERROR);
  }

  if (!agent.isActive) {
    throw ApiError.badRequest('Selected agent is deactivated', ERROR_CODES.AGENT_UNAVAILABLE);
  }

  if (ticket.assignedTo && ticket.assignedTo.toString() === agent._id.toString()) {
    throw ApiError.badRequest('Ticket is already assigned to this agent');
  }

  // An admin may deliberately override availability, so BUSY/OFFLINE is allowed
  // here - it is only automatic assignment that respects availability.
  return applyAssignment({
    ticket,
    agent,
    reason: ASSIGNMENT_REASON.ADMIN_OVERRIDE,
    assignedBy: admin._id,
    assignedByType: ASSIGNED_BY_TYPE.ADMIN,
    note,
  });
}

export function getAssignmentHistory(ticketId) {
  return AssignmentHistory.find({ ticketId })
    .sort({ createdAt: -1 })
    .populate('previousAgent', 'name email avatar')
    .populate('newAgent', 'name email avatar')
    .populate('assignedBy', 'name email avatar')
    .lean();
}

/** Agent roster with live workload - powers the admin dashboard table. */
export async function getAgentWorkloadReport() {
  const agents = await User.find({ role: ROLES.AGENT })
    .select(`${AGENT_FIELDS} lastSeenAt createdAt`)
    .sort({ name: 1 })
    .lean();

  const workloads = await getAgentWorkloads(agents.map((agent) => agent._id));

  const resolvedCounts = await Ticket.aggregate([
    {
      $match: {
        assignedTo: { $in: agents.map((agent) => agent._id) },
        status: { $in: [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED] },
      },
    },
    { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
  ]);

  const resolvedMap = new Map(resolvedCounts.map((row) => [row._id.toString(), row.count]));

  return agents.map((agent) => ({
    ...agent,
    activeTickets: workloads.get(agent._id.toString()) ?? 0,
    resolvedTickets: resolvedMap.get(agent._id.toString()) ?? 0,
  }));
}
