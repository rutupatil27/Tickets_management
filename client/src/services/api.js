import axios from 'axios';
import appConfig from '../config/appConfig.js';

/**
 * The one and only axios instance.
 * Every *Api.js module builds on this, so the base URL, auth header and error
 * shape are configured in a single place (spec §38).
 */
const api = axios.create({
  baseURL: appConfig.apiBaseUrl,
  timeout: appConfig.requestTimeout,
  // No default Content-Type on purpose. Axios labels plain-object bodies as
  // JSON by itself, and a global 'application/json' default makes it
  // JSON-stringify FormData too - which silently turned photo uploads into
  // `{"image":{}}` with no file attached.
});

export const tokenStorage = {
  get: () => localStorage.getItem(appConfig.storageKeys.token),
  set: (token) => localStorage.setItem(appConfig.storageKeys.token, token),
  clear: () => {
    localStorage.removeItem(appConfig.storageKeys.token);
    localStorage.removeItem(appConfig.storageKeys.user);
  },
};

api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Callback registered by AuthContext so a 401 can log the user out cleanly. */
let onUnauthorized = null;
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // The backend always answers with { success, message, errorCode }.
    const payload = error.response?.data;

    const normalised = {
      status: error.response?.status ?? 0,
      message:
        payload?.message ||
        (error.code === 'ECONNABORTED'
          ? 'The request timed out. Please try again.'
          : error.message === 'Network Error'
            ? 'Cannot reach the SupportDesk server. Is the backend running?'
            : 'Something went wrong. Please try again.'),
      errorCode: payload?.errorCode ?? 'NETWORK_ERROR',
      details: payload?.details ?? null,
    };

    const isAuthCall = error.config?.url?.includes('/auth/login') ||
      error.config?.url?.includes('/auth/register');

    if (normalised.status === 401 && !isAuthCall) {
      tokenStorage.clear();
      onUnauthorized?.(normalised);
    }

    return Promise.reject(normalised);
  },
);

export default api;
