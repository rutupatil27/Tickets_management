import { Radio, WifiOff } from 'lucide-react';
import cn from '../../utils/cn.js';
import { useSocket } from '../../hooks/useSocket.js';

const LABELS = {
  connected: { text: 'Live', tone: 'text-success-700 bg-success-50 ring-success-200' },
  connecting: { text: 'Connecting', tone: 'text-warning-700 bg-warning-50 ring-warning-200' },
  reconnecting: { text: 'Reconnecting', tone: 'text-warning-700 bg-warning-50 ring-warning-200' },
  error: { text: 'Offline', tone: 'text-danger-700 bg-danger-50 ring-danger-200' },
  idle: { text: 'Offline', tone: 'text-ink-500 bg-ink-100 ring-ink-200' },
};

/**
 * Real-time transport indicator (spec §67).
 * The user must always be able to tell whether live updates are flowing.
 */
export function ConnectionStatus({ compact = false, className }) {
  const { status } = useSocket();
  const meta = LABELS[status] ?? LABELS.idle;
  const isLive = status === 'connected';

  return (
    <span
      title={isLive ? 'Real-time updates are active' : 'Real-time updates are temporarily unavailable'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        meta.tone,
        className,
      )}
    >
      {isLive ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success-500" />
        </span>
      ) : status === 'error' || status === 'idle' ? (
        <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Radio className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
      )}
      {!compact && meta.text}
    </span>
  );
}

export default ConnectionStatus;
