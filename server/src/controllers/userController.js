import { asyncHandler } from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { ROLES } from '../config/constants.js';
import {
  createAgent,
  getUserById,
  listAssignableAgents,
  listUsers,
  updateAvailability,
  updateUserActiveStatus,
  updateUserProfile,
  updateUserRole,
} from '../services/userService.js';
import { getAgentWorkloadReport } from '../services/assignmentService.js';

/** GET /api/users  (admin) */
export const list = asyncHandler(async (req, res) => {
  const { users, pagination } = await listUsers(req.query);
  return sendSuccess(res, { message: 'Users fetched', data: { users, pagination } });
});

/** GET /api/users/agents  (agent/admin) - lightweight picker list */
export const agents = asyncHandler(async (_req, res) => {
  const data = await listAssignableAgents();
  return sendSuccess(res, { message: 'Agents fetched', data: { agents: data } });
});

/** GET /api/users/agents/workload  (admin) */
export const agentWorkload = asyncHandler(async (_req, res) => {
  const data = await getAgentWorkloadReport();
  return sendSuccess(res, { message: 'Agent workload fetched', data: { agents: data } });
});

/** GET /api/users/:id  (admin, or self) */
export const getOne = asyncHandler(async (req, res) => {
  const isSelf = req.user._id.toString() === req.params.id;
  if (!isSelf && req.user.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('You can only view your own profile');
  }

  const user = await getUserById(req.params.id);
  return sendSuccess(res, { message: 'User fetched', data: { user } });
});

/** POST /api/users/agents  (admin) - agents only; customers self-register */
export const createAgentAccount = asyncHandler(async (req, res) => {
  const user = await createAgent({ payload: req.body });
  return sendCreated(res, { message: `Agent account created for ${user.name}`, data: { user } });
});

/** PATCH /api/users/:id */
export const update = asyncHandler(async (req, res) => {
  const user = await updateUserProfile({
    actor: req.user,
    userId: req.params.id,
    payload: req.body,
  });

  return sendSuccess(res, { message: 'User updated', data: { user } });
});

/** PATCH /api/users/:id/role  (admin) */
export const changeRole = asyncHandler(async (req, res) => {
  const user = await updateUserRole({
    admin: req.user,
    userId: req.params.id,
    role: req.body.role,
  });

  return sendSuccess(res, { message: `Role updated to ${user.role}`, data: { user } });
});

/** PATCH /api/users/:id/active  (admin) */
export const changeActiveStatus = asyncHandler(async (req, res) => {
  const user = await updateUserActiveStatus({
    admin: req.user,
    userId: req.params.id,
    isActive: req.body.isActive,
  });

  return sendSuccess(res, {
    message: user.isActive ? 'Account activated' : 'Account deactivated',
    data: { user },
  });
});

/**
 * PATCH /api/users/:id/availability
 * Agent self-service (or admin override). Switching to AVAILABLE drains the
 * waiting queue, so the response reports how many tickets were picked up.
 */
export const changeAvailability = asyncHandler(async (req, res) => {
  const { user, assignedFromQueue } = await updateAvailability({
    actor: req.user,
    userId: req.params.id,
    availabilityStatus: req.body.availabilityStatus,
  });

  const suffix = assignedFromQueue
    ? ` ${assignedFromQueue} queued ticket(s) were assigned to you.`
    : '';

  return sendSuccess(res, {
    message: `Availability set to ${user.availabilityStatus}.${suffix}`,
    data: { user, assignedFromQueue },
  });
});
