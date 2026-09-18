import api from './api.js';
import appConfig from '../config/appConfig.js';

export const messageApi = {
  list: (ticketId, params) => api.get(`/tickets/${ticketId}/messages`, { params }),
  send: (ticketId, content) => api.post(`/tickets/${ticketId}/messages`, { content }),
  markRead: (ticketId) => api.patch(`/tickets/${ticketId}/messages/read`),

  /**
   * Multipart upload. Works because the shared axios instance has no default
   * JSON Content-Type (see api.js), so axios sends real multipart with a boundary.
   */
  sendPhoto: (ticketId, { file, content = '' }, onProgress) => {
    const form = new FormData();
    form.append('image', file, file.name);
    if (content) form.append('content', content);

    return api.post(`/tickets/${ticketId}/messages/photo`, form, {
      timeout: appConfig.chat.photo.uploadTimeout,
      onUploadProgress: (event) => {
        if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
      },
    });
  },

  /**
   * Photos are served by an authorized route, so a plain <img src> (which cannot
   * send the Authorization header) would be refused. Fetch as a Blob instead.
   * `url` is the server path "/api/tickets/..."; the axios baseURL already ends in /api.
   */
  fetchAttachment: (url) => api.get(url.replace(/^\/api/, ''), { responseType: 'blob' }),
};

export default messageApi;
