import api from './api.js';

const clean = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      if (value === undefined || value === null || value === '') return false;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    }),
  );

export const userApi = {
  list: (params) => api.get('/users', { params: clean(params) }),
  get: (id) => api.get(`/users/${id}`),
  // Admins can only create agents; customers register themselves.
  createAgent: (payload) => api.post('/users/agents', payload),
  update: (id, payload) => api.patch(`/users/${id}`, payload),
  changeRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
  setActive: (id, isActive) => api.patch(`/users/${id}/active`, { isActive }),
  setAvailability: (id, availabilityStatus) =>
    api.patch(`/users/${id}/availability`, { availabilityStatus }),
  agents: () => api.get('/users/agents'),
  agentWorkload: () => api.get('/users/agents/workload'),
};

export default userApi;
