import { Link } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, Search, UserCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import cn from '../../utils/cn.js';
import Avatar from '../common/Avatar.jsx';
import ConnectionStatus from './ConnectionStatus.jsx';
import NotificationBell from './NotificationBell.jsx';
import AvailabilityToggle from './AvailabilityToggle.jsx';
import { greetingFor, firstName } from '../../utils/format.js';
import { ROLES, ROLE_BASE_PATH, ROLE_LABELS } from '../../utils/constants.js';

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 transition hover:bg-ink-100"
      >
        <Avatar
          name={user.name}
          src={user.avatar}
          size="sm"
          availability={user.role === ROLES.AGENT ? user.availabilityStatus : undefined}
        />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-bold text-ink-900">{user.name}</span>
          <span className="block text-[11px] font-medium text-ink-400">
            {ROLE_LABELS[user.role]}
          </span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-ink-400 sm:block" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 animate-fade-in overflow-hidden rounded-card border border-ink-200/70 bg-white shadow-pop">
          <div className="border-b border-ink-100 px-4 py-3">
            <p className="truncate text-sm font-bold text-ink-900">{user.name}</p>
            <p className="truncate text-xs text-ink-500">{user.email}</p>
          </div>
          <Link
            to={`${ROLE_BASE_PATH[user.role]}/profile`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-ink-600 transition hover:bg-ink-50"
          >
            <UserCircle className="h-4 w-4 text-ink-400" />
            My profile
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 border-t border-ink-100 px-4 py-2.5 text-sm font-medium text-danger-600 transition hover:bg-danger-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Header row: greeting card on the left, live status + notifications + user on
 * the right - matching the reference dashboard layout.
 */
export function Topbar({ user, onOpenMobileNav, onLogout, onSearch, searchValue }) {
  return (
    <header className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-ink-200/70 bg-white text-ink-600 shadow-soft lg:hidden"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>

      <div className="hidden min-w-0 flex-1 items-center rounded-2xl border border-ink-200/70 bg-white px-4 py-2.5 shadow-soft sm:flex md:min-w-[260px] md:flex-none">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink-900">
            {greetingFor()}, {firstName(user.name)}
          </p>
          <p className="truncate text-xs text-ink-400">
            {user.role === ROLES.ADMIN
              ? 'Here is what is happening across the desk'
              : user.role === ROLES.AGENT
                ? 'Your queue and latest updates'
                : 'Track your support requests here'}
          </p>
        </div>
      </div>

      {onSearch && (
        <div className="relative order-last w-full min-w-0 flex-1 md:order-none md:w-auto">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search by ticket ID or subject..."
            aria-label="Search tickets"
            className="h-11 w-full rounded-2xl border border-ink-200/70 bg-white pl-11 pr-4 text-sm text-ink-800 shadow-soft outline-none transition placeholder:text-ink-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-500/10"
          />
        </div>
      )}

      <div className={cn('ml-auto flex items-center gap-2', onSearch && 'md:ml-0')}>
        {user.role === ROLES.AGENT && <AvailabilityToggle />}

        <div className="flex items-center gap-1 rounded-2xl border border-ink-200/70 bg-white px-2 py-1 shadow-soft">
          <span className="hidden px-1.5 sm:block">
            <ConnectionStatus />
          </span>
          <NotificationBell />
        </div>

        <div className="rounded-2xl border border-ink-200/70 bg-white px-1.5 py-1.5 shadow-soft">
          <UserMenu user={user} onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
}

export default Topbar;
