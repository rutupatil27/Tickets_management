import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader2, X } from 'lucide-react';
import { useAuthorizedImage } from '../../hooks/useAuthorizedImage.js';
import { formatBytes } from '../../utils/format.js';

/** Full-size photo viewer. Escape or a click on the backdrop closes it. */
export function ImageLightbox({ attachment, onClose }) {
  const { src, loading } = useAuthorizedImage(attachment?.url);

  useEffect(() => {
    if (!attachment) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [attachment, onClose]);

  if (!attachment) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={attachment.filename}
      className="fixed inset-0 z-50 flex flex-col bg-ink-900/90 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{attachment.filename}</p>
          <p className="text-xs text-white/60">{formatBytes(attachment.size)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {src && (
            <a
              href={src}
              download={attachment.filename}
              className="grid h-10 w-10 place-items-center rounded-xl text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Download photo"
            >
              <Download className="h-5 w-5" />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label="Close photo"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Clicking anywhere outside the photo closes the viewer. */}
      <div
        className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0 sm:p-8 sm:pt-0"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        {loading || !src ? (
          <Loader2 className="h-8 w-8 animate-spin text-white/70" aria-label="Loading photo" />
        ) : (
          <img
            src={src}
            alt={attachment.filename}
            className="max-h-full max-w-full rounded-lg object-contain shadow-pop"
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

export default ImageLightbox;
