import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import {
  getAdminDashboard,
  getAgentDashboard,
  getCustomerDashboard,
} from '../services/dashboardService.js';

/** GET /api/dashboard/customer */
export const customer = asyncHandler(async (req, res) => {
  const data = await getCustomerDashboard(req.user);
  return sendSuccess(res, { message: 'Customer dashboard', data });
});

/** GET /api/dashboard/agent */
export const agent = asyncHandler(async (req, res) => {
  const data = await getAgentDashboard(req.user);
  return sendSuccess(res, { message: 'Agent dashboard', data });
});

/** GET /api/dashboard/admin */
export const admin = asyncHandler(async (_req, res) => {
  const data = await getAdminDashboard();
  return sendSuccess(res, { message: 'Admin dashboard', data });
});
