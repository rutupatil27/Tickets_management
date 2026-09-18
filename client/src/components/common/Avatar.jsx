import cn from '../../utils/cn.js';
import { avatarTone, availabilityStyle } from '../../theme/statusStyles.js';
import { initialsOf } from '../../utils/format.js';

const SIZES = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
};

const DOT_SIZES = {
  xs: 'h-2 w-2',
  sm: 'h-2.5 w-2.5',
  md: 'h-3 w-3',
  lg: 'h-3.5 w-3.5',
  xl: 'h-4 w-4',
};

/**
 * Falls back to tinted initials when no avatar image exists, which is the norm
 * in this app - the tint is derived from the name so it stays stable.
 */
export function Avatar({ name = '', src, size = 'md', availability, className, ring = true }) {
  const initials = initialsOf(name);

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={cn(
            'rounded-full object-cover',
            SIZES[size],
            ring && 'ring-2 ring-white',
          )}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            'grid place-items-center rounded-full font-bold uppercase',
            SIZES[size],
            avatarTone(name),
            ring && 'ring-2 ring-white',
          )}
        >
          {initials}
        </span>
      )}

      {availability && (
        <span
          title={availability}
          className={cn(
            'absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-white',
            DOT_SIZES[size],
            availabilityStyle(availability).dot,
          )}
        />
      )}
      {src ? null : <span className="sr-only">{name}</span>}
    </span>
  );
}

export default Avatar;
