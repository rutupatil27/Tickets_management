import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, ShieldOff, UserCheck, UserPlus, Users } from 'lucide-react';
import Card from '../../components/common/Card.jsx';
import Button from '../../components/common/Button.jsx';
import Avatar from '../../components/common/Avatar.jsx';
import { AvailabilityBadge, RoleBadge } from '../../components/common/Badge.jsx';
import { ConfirmDialog } from '../../components/common/Modal.jsx';
import CreateAgentModal from '../../components/users/CreateAgentModal.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import { EmptyState, ErrorState, TableSkeleton } from '../../components/common/States.jsx';
import PageHeader from '../../components/layout/PageHeader.jsx';
import userApi from '../../services/userApi.js';
import useDebouncedValue from '../../hooks/useDebouncedValue.js';
import { formatDate, formatRelative } from '../../utils/format.js';
import { ROLES, ROLE_LABELS } from '../../utils/constants.js';

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 400);

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionSaving, setActionSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await userApi.list({
        page,
        limit: 10,
        search: debouncedSearch || undefined,
        role: roleFilter || undefined,
      });
      setUsers(data.users);
      setPagination(data.pagination);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, roleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const changeRole = async (user, role) => {
    try {
      const response = await userApi.changeRole(user._id, role);
      toast.success(response.message);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const confirmToggleActive = async () => {
    setActionSaving(true);
    try {
      const response = await userApi.setActive(pendingAction.user._id, !pendingAction.user.isActive);
      toast.success(response.message);
      setPendingAction(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Manage users"
        subtitle="Customers sign up on their own. Admins only add support agents."
        actions={
          <Button icon={UserPlus} onClick={() => setCreateOpen(true)}>
            Add agent
          </Button>
        }
      />

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name or email..."
              aria-label="Search users"
              className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-ink-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-500/10"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by role"
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-500/10"
          >
            <option value="">All roles</option>
            {Object.values(ROLES).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <TableSkeleton rows={6} columns={5} />
        ) : error ? (
          <ErrorState message={error.message} onRetry={load} />
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="No users match this search" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left">
                <thead>
                  <tr className="border-b border-ink-100 bg-surface-muted/60">
                    <th scope="col" className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-ink-400">User</th>
                    <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-ink-400">Role</th>
                    <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-ink-400">Availability</th>
                    <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-ink-400">Joined</th>
                    <th scope="col" className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-ink-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {users.map((user) => (
                    <tr key={user._id} className={user.isActive ? '' : 'bg-danger-50/30'}>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-3">
                          <Avatar
                            name={user.name}
                            src={user.avatar}
                            size="sm"
                            availability={user.role === ROLES.AGENT ? user.availabilityStatus : undefined}
                            ring={false}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-ink-800">
                              {user.name}
                            </span>
                            <span className="block truncate text-xs text-ink-500">{user.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <select
                          value={user.role}
                          onChange={(event) => changeRole(user, event.target.value)}
                          aria-label={`Role for ${user.name}`}
                          className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-xs font-semibold text-ink-700 outline-none focus:border-brand-300"
                        >
                          {Object.values(ROLES).map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3.5">
                        {user.role === ROLES.AGENT ? (
                          <span className="flex items-center gap-2">
                            <AvailabilityBadge availability={user.availabilityStatus} size="xs" />
                            <span className="text-xs text-ink-400">{user.activeTickets} active</span>
                          </span>
                        ) : (
                          <RoleBadge role={user.role} />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-ink-500">
                        {formatDate(user.createdAt)}
                        {user.lastSeenAt && (
                          <span className="block text-[11px] text-ink-400">
                            seen {formatRelative(user.lastSeenAt)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          size="xs"
                          variant={user.isActive ? 'dangerSoft' : 'soft'}
                          icon={user.isActive ? ShieldOff : UserCheck}
                          onClick={() => setPendingAction({ user })}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={pagination} onPageChange={setPage} />
          </>
        )}
      </Card>

      <CreateAgentModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />

      <ConfirmDialog
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={confirmToggleActive}
        loading={actionSaving}
        variant={pendingAction?.user.isActive ? 'danger' : 'primary'}
        confirmLabel={pendingAction?.user.isActive ? 'Deactivate' : 'Activate'}
        title={
          pendingAction?.user.isActive
            ? `Deactivate ${pendingAction?.user.name}?`
            : `Activate ${pendingAction?.user.name}?`
        }
        description={
          pendingAction?.user.isActive
            ? 'They will be signed out and blocked from logging in. Their existing tickets stay assigned to them - reassign those separately if needed.'
            : 'They will be able to sign in again. If they are an agent, they can set themselves available and start receiving tickets.'
        }
      />
    </div>
  );
}
