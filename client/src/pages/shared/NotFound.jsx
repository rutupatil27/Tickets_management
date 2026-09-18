import { Compass, Home } from 'lucide-react';
import Button from '../../components/common/Button.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { ROLE_HOME } from '../../utils/constants.js';

export default function NotFound() {
  const { user } = useAuth();
  const home = ROLE_HOME[user?.role] ?? '/login';

  return (
    <div className="grid min-h-screen place-items-center bg-surface-page p-6">
      <div className="card w-full max-w-md p-10 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-500">
          <Compass className="h-6 w-6" />
        </span>
        <p className="mt-5 text-4xl font-extrabold tracking-tight text-ink-900">404</p>
        <h1 className="mt-1 text-lg font-bold text-ink-800">Page not found</h1>
        <p className="mt-2 text-sm text-ink-500">
          That link does not exist, or you no longer have access to it.
        </p>
        <Button to={home} icon={Home} className="mt-6">
          {user ? 'Back to dashboard' : 'Go to sign in'}
        </Button>
      </div>
    </div>
  );
}
