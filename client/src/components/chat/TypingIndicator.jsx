import cn from '../../utils/cn.js';

/**
 * Ephemeral presence hint. Typing events are Socket.IO only and are never
 * written to MongoDB (spec §26).
 */
export function TypingIndicator({ names = [], className }) {
  if (!names.length) return null;

  const label =
    names.length === 1
      ? `${names[0]} is typing`
      : `${names.slice(0, 2).join(' and ')} are typing`;

  return (
    <div className={cn('flex items-center gap-2 px-4 py-1.5 text-xs text-ink-500', className)}>
      <span className="flex items-center gap-1" aria-hidden="true">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-brand-400"
            style={{ animationDelay: `${dot * 0.15}s` }}
          />
        ))}
      </span>
      <span className="font-medium">{label}...</span>
    </div>
  );
}

export default TypingIndicator;
