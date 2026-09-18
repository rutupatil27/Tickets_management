import { Ticket } from '../models/Ticket.js';
import { User } from '../models/User.js';
import {
  ACTIVE_TICKET_STATUSES,
  ROLES,
  TICKET_CATEGORIES,
  TICKET_PRIORITY_VALUES,
  TICKET_STATUS,
  TICKET_STATUS_VALUES,
} from '../config/constants.js';
import { countWaitingTickets, getAgentWorkloadReport } from './assignmentService.js';
import { totalUnreadMessages } from './messageService.js';

const TICKET_CARD_FIELDS = 'ticketNumber subject status priority category createdAt updatedAt lastMessageAt';

/** Counts per status, always returning every status key (0 when absent). */
async function countByStatus(match = {}) {
  const rows = await Ticket.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const base = TICKET_STATUS_VALUES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {});
  rows.forEach((row) => {
    base[row._id] = row.count;
  });
  return base;
}

async function countByField(field, values, match = {}) {
  const rows = await Ticket.aggregate([
    { $match: match },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  ]);

  const base = values.reduce((acc, value) => ({ ...acc, [value]: 0 }), {});
  rows.forEach((row) => {
    if (row._id in base) base[row._id] = row.count;
  });
  return base;
}

/** Ticket volume for the last N months, oldest first (for the bar chart). */
async function ticketsOverTime(match = {}, months = 12) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - (months - 1));

  const rows = await Ticket.aggregate([
    { $match: { ...match, createdAt: { $gte: start } } },
    {
      $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        total: { $sum: 1 },
        resolved: {
          $sum: {
            $cond: [{ $in: ['$status', [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED]] }, 1, 0],
          },
        },
      },
    },
  ]);

  const lookup = new Map(rows.map((row) => [`${row._id.year}-${row._id.month}`, row]));
  const series = [];

  for (let i = 0; i < months; i += 1) {
    const cursor = new Date(start);
    cursor.setUTCMonth(start.getUTCMonth() + i);
    const key = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth() + 1}`;
    const row = lookup.get(key);

    series.push({
      key,
      label: cursor.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      year: cursor.getUTCFullYear(),
      total: row?.total ?? 0,
      resolved: row?.resolved ?? 0,
      open: (row?.total ?? 0) - (row?.resolved ?? 0),
    });
  }

  return series;
}

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

/* -------------------------------------------------------------------------- */
/* Customer                                                                   */
/* -------------------------------------------------------------------------- */

export async function getCustomerDashboard(user) {
  const match = { createdBy: user._id };

  const [byStatus, byCategory, byPriority, recentTickets, timeline, unreadMessages] = await Promise.all([
    countByStatus(match),
    countByField('category', TICKET_CATEGORIES, match),
    countByField('priority', TICKET_PRIORITY_VALUES, match),
    Ticket.find(match)
      .select(TICKET_CARD_FIELDS)
      .populate('assignedTo', 'name avatar availabilityStatus')
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean(),
    ticketsOverTime(match, 6),
    totalUnreadMessages({ user }),
  ]);

  const total = Object.values(byStatus).reduce((sum, value) => sum + value, 0);

  return {
    stats: {
      total,
      open: byStatus.OPEN + byStatus.WAITING_FOR_AGENT + byStatus.ASSIGNED,
      inProgress: byStatus.IN_PROGRESS + byStatus.WAITING_FOR_CUSTOMER + byStatus.REOPENED,
      resolved: byStatus.RESOLVED,
      closed: byStatus.CLOSED,
      unreadMessages,
    },
    byStatus,
    byCategory,
    byPriority,
    timeline,
    recentTickets,
  };
}

/* -------------------------------------------------------------------------- */
/* Agent                                                                      */
/* -------------------------------------------------------------------------- */

export async function getAgentDashboard(user) {
  const match = { assignedTo: user._id };

  const [byStatus, byPriority, byCategory, resolvedToday, myTickets, timeline, unreadMessages, waitingQueue, agentReport] =
    await Promise.all([
      countByStatus(match),
      countByField('priority', TICKET_PRIORITY_VALUES, match),
      countByField('category', TICKET_CATEGORIES, match),
      Ticket.countDocuments({
        assignedTo: user._id,
        status: { $in: [TICKET_STATUS.RESOLVED, TICKET_STATUS.CLOSED] },
        resolvedAt: { $gte: startOfToday() },
      }),
      Ticket.find({ ...match, status: { $in: ACTIVE_TICKET_STATUSES } })
        .select(TICKET_CARD_FIELDS)
        .populate('createdBy', 'name avatar email')
        .sort({ priorityWeight: -1, updatedAt: -1 })
        .limit(6)
        .lean(),
      ticketsOverTime(match, 6),
      totalUnreadMessages({ user }),
      countWaitingTickets(),
      getAgentWorkloadReport(),
    ]);

  const activeTickets = ACTIVE_TICKET_STATUSES.reduce((sum, status) => sum + byStatus[status], 0);
  const totalAssigned = Object.values(byStatus).reduce((sum, value) => sum + value, 0);

  const averageWorkload = agentReport.length
    ? Number(
        (agentReport.reduce((sum, agent) => sum + agent.activeTickets, 0) / agentReport.length).toFixed(1),
      )
    : 0;

  return {
    availability: user.availabilityStatus,
    stats: {
      activeTickets,
      waitingForCustomer: byStatus.WAITING_FOR_CUSTOMER,
      inProgress: byStatus.IN_PROGRESS,
      resolvedToday,
      totalAssigned,
      resolved: byStatus.RESOLVED + byStatus.CLOSED,
      unreadMessages,
      waitingQueue,
      averageWorkload,
    },
    byStatus,
    byPriority,
    byCategory,
    timeline,
    myTickets,
  };
}

/* -------------------------------------------------------------------------- */
/* Admin                                                                      */
/* -------------------------------------------------------------------------- */

export async function getAdminDashboard() {
  const [byStatus, byPriority, byCategory, timeline, agentWorkload, userCounts, recentTickets, topCustomers] =
    await Promise.all([
      countByStatus(),
      countByField('priority', TICKET_PRIORITY_VALUES),
      countByField('category', TICKET_CATEGORIES),
      ticketsOverTime({}, 12),
      getAgentWorkloadReport(),
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      Ticket.find()
        .select(TICKET_CARD_FIELDS)
        .populate('createdBy', 'name email avatar')
        .populate('assignedTo', 'name email avatar')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
      Ticket.aggregate([
        { $group: { _id: '$createdBy', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        { $project: { _id: 1, count: 1, name: '$user.name', email: '$user.email', avatar: '$user.avatar' } },
      ]),
    ]);

  const roleCounts = userCounts.reduce(
    (acc, row) => ({ ...acc, [row._id]: row.count }),
    { [ROLES.CUSTOMER]: 0, [ROLES.AGENT]: 0, [ROLES.ADMIN]: 0 },
  );

  const total = Object.values(byStatus).reduce((sum, value) => sum + value, 0);

  return {
    stats: {
      total,
      open: byStatus.OPEN,
      waiting: byStatus.WAITING_FOR_AGENT,
      assigned: byStatus.ASSIGNED,
      inProgress: byStatus.IN_PROGRESS + byStatus.WAITING_FOR_CUSTOMER + byStatus.REOPENED,
      resolved: byStatus.RESOLVED,
      closed: byStatus.CLOSED,
      totalUsers: roleCounts[ROLES.CUSTOMER] + roleCounts[ROLES.AGENT] + roleCounts[ROLES.ADMIN],
      totalCustomers: roleCounts[ROLES.CUSTOMER],
      totalAgents: roleCounts[ROLES.AGENT],
      availableAgents: agentWorkload.filter(
        (agent) => agent.isActive && agent.availabilityStatus === 'available',
      ).length,
      totalCategories: TICKET_CATEGORIES.length,
    },
    byStatus,
    byPriority,
    byCategory,
    timeline,
    agentWorkload,
    recentTickets,
    topCustomers,
  };
}
