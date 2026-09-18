import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { ROLE_HOME } from '../utils/constants.js';

function FullPageLoader({ label = 'Loading SupportDesk...' }) {
  return (
    <div className="grid min-h-screen place-items-center bg-surface-page">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
        <p className="text-sm font-medium text-ink-500">{label}</p>
      </div>
    </div>
  );
}

/** Requires a signed-in user; remembers where they were headed. */
export function ProtectedRoute() {
  const { isAuthenticated, initialising } = useAuth();
  const location = useLocation();

  if (initialising) return <FullPageLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

/**
 * Requires one of `allow`. A signed-in user hitting the wrong section is sent
 * to their own home rather than shown a dead end.
 *
 * This is a UX guard only - the backend enforces the same rules on every call.
 */
export function RoleRoute({ allow = [] }) {
  const { user, initialising } = useAuth();

  if (initialising) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  if (!allow.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] ?? '/login'} replace />;
  }

  return <Outlet />;
}

/** Keeps a signed-in user away from /login and /register. */
export function PublicOnlyRoute() {
  const { user, initialising } = useAuth();

  if (initialising) return <FullPageLoader />;
  if (user) return <Navigate to={ROLE_HOME[user.role] ?? '/'} replace />;

  return <Outlet />;
}

export default ProtectedRoute;
