import { format, formatDistanceToNowStrict, isThisYear, isToday, isYesterday } from 'date-fns';

const toDate = (value) => (value instanceof Date ? value : new Date(value));

export function formatDateTime(value) {
  if (!value) return '--';
  return format(toDate(value), 'd MMM yyyy, h:mm a');
}

export function formatDate(value) {
  if (!value) return '--';
  return format(toDate(value), 'd MMM yyyy');
}

export function formatTime(value) {
  if (!value) return '';
  return format(toDate(value), 'h:mm a');
}

/** "3 minutes ago" style stamp used across ticket lists and the chat. */
export function formatRelative(value) {
  if (!value) return '--';
  return `${formatDistanceToNowStrict(toDate(value))} ago`;
}

/** Compact stamp for tables: time today, "Yesterday", date otherwise. */
export function formatSmart(value) {
  if (!value) return '--';
  const date = toDate(value);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, isThisYear(date) ? 'd MMM' : 'd MMM yyyy');
}

/** Day separator label inside the conversation. */
export function formatDayLabel(value) {
  const date = toDate(value);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, isThisYear(date) ? 'EEEE, d MMMM' : 'd MMMM yyyy');
}

export function initialsOf(name = '') {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

export function truncate(value = '', length = 80) {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1).trimEnd()}...`;
}

export function firstName(name = '') {
  return name.split(/\s+/)[0] || name;
}

/** 1240 -> "1.2k" for stat tiles. */
export function compactNumber(value = 0) {
  if (Math.abs(value) < 1000) return String(value);
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

/** 2048576 -> "2 MB" for attachment sizes. */
export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

export function greetingFor(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
