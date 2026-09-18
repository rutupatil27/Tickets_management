import cn from '../../utils/cn.js';
import {
  availabilityStyle,
  priorityStyle,
  roleStyle,
  statusStyle,
} from '../../theme/statusStyles.js';
import {
  AVAILABILITY_LABELS,
  PRIORITY_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
} from '../../utils/constants.js';

const SIZES = {
  xs: 'px-2 py-0.5 text-[11px]',
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
};

export function Badge({ children, className, size = 'sm', dot, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold leading-none',
        SIZES[size],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, size = 'sm', withDot = true, className }) {
  const style = statusStyle(status);
  return (
    <Badge size={size} className={cn(style.badge, className)} dot={withDot ? style.dot : undefined}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export function PriorityBadge({ priority, size = 'sm', withDot = true, className }) {
  const style = priorityStyle(priority);
  return (
    <Badge size={size} className={cn(style.badge, className)} dot={withDot ? style.dot : undefined}>
      {PRIORITY_LABELS[priority] ?? priority}
    </Badge>
  );
}

export function AvailabilityBadge({ availability, size = 'sm', className }) {
  const style = availabilityStyle(availability);
  return (
    <Badge size={size} className={cn(style.badge, className)} dot={style.dot}>
      {AVAILABILITY_LABELS[availability] ?? availability}
    </Badge>
  );
}

export function RoleBadge({ role, size = 'xs', className }) {
  return (
    <Badge size={size} className={cn(roleStyle(role), className)}>
      {ROLE_LABELS[role] ?? role}
    </Badge>
  );
}

export function CategoryBadge({ category, size = 'xs', className }) {
  return (
    <Badge size={size} className={cn('bg-ink-100 text-ink-600', className)}>
      {category}
    </Badge>
  );
}

export default Badge;
