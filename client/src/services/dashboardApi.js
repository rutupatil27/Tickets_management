import api from './api.js';

export const dashboardApi = {
  customer: () => api.get('/dashboard/customer'),
  agent: () => api.get('/dashboard/agent'),
  admin: () => api.get('/dashboard/admin'),

  /** Resolves the right endpoint for whichever role is logged in. */
  forRole: (role) => {
    if (role === 'admin') return api.get('/dashboard/admin');
    if (role === 'agent') return api.get('/dashboard/agent');
    return api.get('/dashboard/customer');
  },
};

export default dashboardApi;
