import { Link } from 'react-router-dom';
import { Headset } from 'lucide-react';
import cn from '../../utils/cn.js';
import appConfig from '../../config/appConfig.js';
import { ROLE_HOME } from '../../utils/constants.js';

export function Logo({ role, className, compact = false }) {
  return (
    <Link
      to={ROLE_HOME[role] ?? '/login'}
      className={cn('flex items-center gap-2.5', className)}
      aria-label={appConfig.appName}
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white shadow-raised">
        <Headset className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block text-[17px] font-extrabold tracking-tight text-ink-900">
            Support<span className="text-brand-600">Desk</span>
          </span>
          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
            helpdesk
          </span>
        </span>
      )}
    </Link>
  );
}

export default Logo;
