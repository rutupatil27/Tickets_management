import { ImageOff } from 'lucide-react';
import cn from '../../utils/cn.js';
import { useAuthorizedImage } from '../../hooks/useAuthorizedImage.js';

/**
 * A photo inside a chat bubble. Reserves space while loading so the
 * conversation does not jump, and fails soft if the photo cannot be loaded.
 */
export function ChatImage({ attachment, onOpen, className }) {
  const { src, loading, error } = useAuthorizedImage(attachment.url);

  if (error) {
    return (
      <div
        className={cn(
          'flex h-32 w-56 max-w-full flex-col items-center justify-center gap-1.5 rounded-xl bg-ink-100 text-ink-400',
          className,
        )}
      >
        <ImageOff className="h-5 w-5" aria-hidden="true" />
        <span className="text-xs">Photo unavailable</span>
      </div>
    );
  }

  if (loading || !src) {
    return <div className={cn('skeleton h-44 w-60 max-w-full rounded-xl', className)} aria-label="Loading photo" />;
  }

  return (
    <button
      type="button"
      onClick={() => onOpen?.(attachment)}
      className={cn(
        'block overflow-hidden rounded-xl focus-visible:ring-2 focus-visible:ring-brand-500',
        className,
      )}
      aria-label={`Open photo ${attachment.filename}`}
    >
      <img
        src={src}
        alt={attachment.filename}
        className="block max-h-72 w-auto max-w-full object-contain transition hover:opacity-95 sm:max-w-[20rem]"
        draggable={false}
      />
    </button>
  );
}

export default ChatImage;
