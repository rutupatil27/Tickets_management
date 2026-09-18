import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import authApi from '../services/authApi.js';
import { setUnauthorizedHandler, tokenStorage } from '../services/api.js';
import appConfig from '../config/appConfig.js';
import { clearAuthorizedImageCache } from '../hooks/useAuthorizedImage.js';

export const AuthContext = createContext(null);

const readCachedUser = () => {
  try {
    const raw = localStorage.getItem(appConfig.storageKeys.user);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/**
 * Holds the session. React Context is enough here - there is no shared mutable
 * state complex enough to justify Redux for this project (spec §39).
 */
export function AuthProvider({ children }) {
  // Start from the cached user so a refresh does not flash the login screen.
  const [user, setUser] = useState(readCachedUser);
  const [initialising, setInitialising] = useState(Boolean(tokenStorage.get()));
  const [submitting, setSubmitting] = useState(false);

  const persist = useCallback((nextUser, token) => {
    if (token) tokenStorage.set(token);
    if (nextUser) {
      localStorage.setItem(appConfig.storageKeys.user, JSON.stringify(nextUser));
      setUser(nextUser);
    }
  }, []);

  const clearSession = useCallback(() => {
    tokenStorage.clear();
    // Ticket photos were fetched with this user's token; drop them with the session.
    clearAuthorizedImageCache();
    setUser(null);
  }, []);

  // A 401 from any request means the token is gone or revoked.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      toast.error('Your session expired. Please sign in again.');
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  // Re-validate the cached session against the server on boot.
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!tokenStorage.get()) {
        setInitialising(false);
        return;
      }

      try {
        const { data } = await authApi.me();
        if (!cancelled) persist(data.user);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setInitialising(false);
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [persist, clearSession]);

  const login = useCallback(
    async (credentials) => {
      setSubmitting(true);
      try {
        const response = await authApi.login(credentials);
        persist(response.data.user, response.data.token);
        toast.success(response.message);
        return response.data.user;
      } finally {
        setSubmitting(false);
      }
    },
    [persist],
  );

  const register = useCallback(
    async (payload) => {
      setSubmitting(true);
      try {
        const response = await authApi.register(payload);
        persist(response.data.user, response.data.token);
        toast.success('Welcome to SupportDesk');
        return response.data.user;
      } finally {
        setSubmitting(false);
      }
    },
    [persist],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Logging out locally must succeed even if the request fails.
    } finally {
      clearSession();
      toast.success('Signed out');
    }
  }, [clearSession]);

  const updateProfile = useCallback(
    async (payload) => {
      const response = await authApi.updateProfile(payload);
      persist(response.data.user);
      toast.success(response.message);
      return response.data.user;
    },
    [persist],
  );

  /** Used when availability changes elsewhere in the app. */
  const patchUser = useCallback(
    (patch) => {
      setUser((current) => {
        if (!current) return current;
        const next = { ...current, ...patch };
        localStorage.setItem(appConfig.storageKeys.user, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: Boolean(user),
      initialising,
      submitting,
      login,
      register,
      logout,
      updateProfile,
      patchUser,
    }),
    [user, initialising, submitting, login, register, logout, updateProfile, patchUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
