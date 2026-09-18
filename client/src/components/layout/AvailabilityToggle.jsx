import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, ChevronDown } from 'lucide-react';
import cn from '../../utils/cn.js';
import { useAuth } from '../../hooks/useAuth.js';
import userApi from '../../services/userApi.js';
import { availabilityStyle } from '../../theme/statusStyles.js';
import { AVAILABILITY_LABELS, AVAILABILITY_OPTIONS } from '../../utils/constants.js';

/**
 * Agent availability switch (spec §42).
 * Switching to "Available" makes the backend drain the waiting queue, so the
 * response reports how many queued tickets landed on this agent.
 */
export function AvailabilityToggle({ className }) {
  const { user, patchUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const current = user?.availabilityStatus ?? 'offline';
  const style = availabilityStyle(current);

  const change = async (value) => {
    if (value === current) {
      setOpen(false);
      return;
    }

    setSaving(true);
    try {
      const response = await userApi.setAvailability(user._id, value);
      patchUser({ availabilityStatus: response.data.user.availabilityStatus });
      toast.success(response.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        disabled={saving}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex h-11 items-center gap-2 rounded-2xl border border-ink-200/70 bg-white px-3 text-sm font-semibold text-ink-700 shadow-soft transition hover:bg-ink-50 disabled:opacity-60"
      >
        <span className={cn('h-2 w-2 shrink-0 rounded-full', style.dot)} />
        <span className="hidden sm:inline">{AVAILABILITY_LABELS[current]}</span>
        <ChevronDown className="h-4 w-4 text-ink-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 animate-fade-in overflow-hidden rounded-card border border-ink-200/70 bg-white shadow-pop">
          <p className="border-b border-ink-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
            My availability
          </p>
          {AVAILABILITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => change(option.value)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-ink-50"
            >
              <span
                className={cn(
                  'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                  availabilityStyle(option.value).dot,
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-800">{option.label}</span>
                <span className="block text-xs text-ink-500">{option.hint}</span>
              </span>
              {option.value === current && (
                <Check className="mt-1 h-4 w-4 shrink-0 text-brand-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default AvailabilityToggle;
