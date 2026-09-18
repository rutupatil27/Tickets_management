import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import cn from '../../utils/cn.js';
import Logo from './Logo.jsx';
import Avatar from '../common/Avatar.jsx';
import Button from '../common/Button.jsx';
import { getNavigation, getQuickAction } from '../../config/navigation/index.js';
import { ROLE_LABELS } from '../../utils/constants.js';

/**
 * Decides which single nav item is highlighted.
 *
 * React Router's own NavLink matching is not enough here for two reasons:
 *   - it ignores the query string, so "My Tickets" (/agent/tickets) and
 *     "Resolved" (/agent/tickets?status=RESOLVED) would both light up;
 *   - a ticket detail page (/customer/tickets/:id) should keep the parent
 *     "My Tickets" entry highlighted.
 *
 * So we score every item and light up the single best match:
 *   query matched -> +1000, then the longest matching path wins.
 */
function scoreItem(item, location) {
  const [path, query] = item.to.split('?');

  const pathMatches = item.end
    ? location.pathname === path
    : location.pathname === path || location.pathname.startsWith(`${path}/`);

  if (!pathMatches) return 0;

  if (query) {
    const current = new URLSearchParams(location.search);
    const expected = new URLSearchParams(query);
    const allPresent = [...expected.entries()].every(([key, value]) =>
      current.getAll(key).includes(value),
    );
    return allPresent ? 1000 + path.length : 0;
  }

  return path.length;
}

function useActiveItem(sections) {
  const location = useLocation();

  return useMemo(() => {
    let best = null;
    let bestScore = 0;

    sections.forEach((section) =>
      section.items.forEach((item) => {
        const score = scoreItem(item, location);
        if (score > bestScore) {
          bestScore = score;
          best = item.to;
        }
      }),
    );

    return best;
  }, [sections, location]);
}

function NavItem({ item, isActive, badgeValue, onNavigate }) {
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
        isActive
          ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200'
          : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800',
      )}
    >
      <Icon
        className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-brand-600' : 'text-ink-400')}
        aria-hidden="true"
      />
      <span className="truncate">{item.label}</span>
      {badgeValue > 0 && (
        <span
          className={cn(
            'ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold',
            isActive ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600',
          )}
        >
          {badgeValue > 99 ? '99+' : badgeValue}
        </span>
      )}
    </Link>
  );
}

/**
 * Role-aware sidebar.
 * The link list itself is not defined here - it comes from the per-role
 * navigation config, so adding a page never means editing this component.
 */
export function Sidebar({ user, badges = {}, onLogout, mobileOpen, onCloseMobile }) {
  const sections = getNavigation(user?.role);
  const quickAction = getQuickAction(user?.role);
  const activeTo = useActiveItem(sections);

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-5 pt-5">
        <Logo role={user?.role} />
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {sections.map((section) => (
          <div key={section.section}>
            <p className="section-label mb-2">{section.section}</p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavItem
                  key={item.label}
                  item={item}
                  isActive={item.to === activeTo}
                  badgeValue={item.badge ? badges[item.badge] : 0}
                  onNavigate={onCloseMobile}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-ink-100 p-3">
        {quickAction && (
          <Button
            to={quickAction.to}
            icon={quickAction.icon}
            size="sm"
            fullWidth
            onClick={onCloseMobile}
          >
            {quickAction.label}
          </Button>
        )}

        <div className="flex items-center gap-3 rounded-xl bg-ink-50 p-2.5">
          <Avatar
            name={user?.name}
            src={user?.avatar}
            size="sm"
            availability={user?.role === 'agent' ? user?.availabilityStatus : undefined}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink-800">{user?.name}</p>
            <p className="truncate text-[11px] font-medium text-ink-400">
              {ROLE_LABELS[user?.role]}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sign out"
            title="Sign out"
            className="rounded-lg p-2 text-ink-400 transition hover:bg-white hover:text-danger-600"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: a fixed, self-contained panel next to the content column. */}
      <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[264px] shrink-0 overflow-hidden rounded-panel border border-ink-200/70 bg-white shadow-card lg:block">
        {content}
      </aside>

      {/* Mobile: slide-out drawer. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink-900/30 backdrop-blur-[2px]"
            onClick={onCloseMobile}
          />
          <aside className="absolute inset-y-0 left-0 w-[280px] animate-fade-in overflow-hidden bg-white shadow-pop">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}

export default Sidebar;
