import api from './api.js';

/** Drops empty values so the query string stays clean. */
const clean = (params = {}) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => {
      if (value === undefined || value === null || value === '') return false;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    }),
  );

export const ticketApi = {
  list: (params) => api.get('/tickets', { params: clean(params) }),
  get: (id) => api.get(`/tickets/${id}`),
  create: (payload) => api.post('/tickets', payload),
  meta: () => api.get('/tickets/meta'),
  updateStatus: (id, payload) => api.patch(`/tickets/${id}/status`, payload),
  updatePriority: (id, priority) => api.patch(`/tickets/${id}/priority`, { priority }),
  reassign: (id, payload) => api.patch(`/tickets/${id}/reassign`, payload),
  history: (id) => api.get(`/tickets/${id}/history`),
};

export default ticketApi;
