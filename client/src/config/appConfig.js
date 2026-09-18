/**
 * Centralised runtime configuration.
 * Every network call in the app resolves its base URL from here - there is no
 * hard-coded `http://localhost:5000` anywhere else in the codebase.
 */

const trimSlash = (value = '') => value.replace(/\/+$/, '');

const API_ROOT = trimSlash(import.meta.env.VITE_API_URL || 'http://localhost:5000');
const SOCKET_ROOT = trimSlash(import.meta.env.VITE_SOCKET_URL || API_ROOT);

export const appConfig = {
  appName: 'SupportDesk',
  tagline: 'Helpdesk & real-time ticket management',

  /** Axios baseURL - all service modules build paths relative to this. */
  apiBaseUrl: `${API_ROOT}/api`,
  socketUrl: SOCKET_ROOT,

  requestTimeout: 20000,

  storageKeys: {
    token: 'supportdesk.token',
    user: 'supportdesk.user',
  },

  pagination: {
    defaultLimit: 10,
    pageSizeOptions: [10, 20, 50],
  },

  chat: {
    typingTimeout: 2000,
    messagePageSize: 100,

    // Mirrors server/src/config/uploads.js. The server re-checks everything;
    // these only let the UI reject a bad file before uploading it.
    photo: {
      maxBytes: 5 * 1024 * 1024,
      acceptedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      uploadTimeout: 60000,
    },
  },
};

export default appConfig;
