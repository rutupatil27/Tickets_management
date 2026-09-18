import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { ROLE_HOME } from '../../utils/constants.js';

/** "/" and "/dashboard" send each role to their own home screen. */
export default function RoleLanding() {
  const { user } = useAuth();
  return <Navigate to={ROLE_HOME[user?.role] ?? '/login'} replace />;
}
