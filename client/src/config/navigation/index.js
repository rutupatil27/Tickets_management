import { ROLES } from '../../utils/constants.js';
import { adminNavigation, adminQuickAction } from './adminNavigation.js';
import { agentNavigation, agentQuickAction } from './agentNavigation.js';
import { customerNavigation, customerQuickAction } from './customerNavigation.js';

const NAVIGATION_BY_ROLE = {
  [ROLES.CUSTOMER]: customerNavigation,
  [ROLES.AGENT]: agentNavigation,
  [ROLES.ADMIN]: adminNavigation,
};

const QUICK_ACTION_BY_ROLE = {
  [ROLES.CUSTOMER]: customerQuickAction,
  [ROLES.AGENT]: agentQuickAction,
  [ROLES.ADMIN]: adminQuickAction,
};

/** Resolves the sidebar definition for whichever role is signed in. */
export const getNavigation = (role) => NAVIGATION_BY_ROLE[role] ?? [];
export const getQuickAction = (role) => QUICK_ACTION_BY_ROLE[role] ?? null;

export { adminNavigation, agentNavigation, customerNavigation };
