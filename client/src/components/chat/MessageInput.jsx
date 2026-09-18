import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ImagePlus, Lock, SendHorizonal, X } from 'lucide-react';
import cn from '../../utils/cn.js';
import appConfig from '../../config/appConfig.js';
import { formatBytes } from '../../utils/format.js';

const MAX_LENGTH = 4000;
const { maxBytes, acceptedTypes } = appConfig.chat.photo;

/** Client-side pre-check only; the server verifies the real file bytes. */
function validatePhoto(file) {
  if (!acceptedTypes.includes(file.type)) return 'Only JPG, PNG, GIF or WebP photos can be shared.';
  if (file.size > maxBytes) return `Photos must be ${formatBytes(maxBytes)} or smaller.`;
  return null;
}

/**
 * Composer for the ticket conversation.
 *
 * Text: typing start/stop is emitted around keystrokes, Enter sends,
 * Shift+Enter adds a new line.
 * Photos: attach with the button, paste from the clipboard, or drop a file on
 * the composer. A photo can be sent alone or with the typed text as a caption.
 */
export function MessageInput({
  onSend,
  onTypingStart,
  onTypingStop,
  disabled = false,
  disabledReason,
  sending = false,
  uploadProgress = null,
}) {
  const [value, setValue] = useState('');
  const [photo, setPhoto] = useState(null); // { file, previewUrl }
  const [dragging, setDragging] = useState(false);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimer = useRef(null);
  const isTyping = useRef(false);

  const stopTyping = useCallback(() => {
    if (!isTyping.current) return;
    isTyping.current = false;
    clearTimeout(typingTimer.current);
    onTypingStop?.();
  }, [onTypingStop]);

  // Never leave a stale "is typing" hanging on the other side.
  useEffect(() => stopTyping, [stopTyping]);

  // Release the preview's object URL whenever the photo changes or unmounts.
  useEffect(() => () => photo && URL.revokeObjectURL(photo.previewUrl), [photo]);

  const attachPhoto = useCallback((file) => {
    if (!file) return;
    const problem = validatePhoto(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setPhoto({ file, previewUrl: URL.createObjectURL(file) });
    textareaRef.current?.focus();
  }, []);

  const removePhoto = () => {
    setPhoto(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resizeTextarea = () => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  };

  const handleChange = (event) => {
    const next = event.target.value.slice(0, MAX_LENGTH);
    setValue(next);
    resizeTextarea();

    if (disabled) return;

    if (!isTyping.current && next.trim()) {
      isTyping.current = true;
      onTypingStart?.();
    }

    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(stopTyping, appConfig.chat.typingTimeout);
  };

  const canSend = Boolean(value.trim() || photo) && !sending;

  const submit = async (event) => {
    event?.preventDefault();
    if (!canSend || disabled) return;

    const content = value.trim();
    stopTyping();

    const delivered = await onSend({ content, file: photo?.file ?? null });

    // Keep the draft and the photo on failure so nothing is silently lost.
    if (delivered !== false) {
      setValue('');
      removePhoto();
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  // Screenshots are usually on the clipboard - pasting one attaches it.
  const handlePaste = (event) => {
    const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith('image/'));
    if (file) {
      event.preventDefault();
      attachPhoto(file);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    attachPhoto(event.dataTransfer?.files?.[0]);
  };

  if (disabled) {
    return (
      <div className="flex items-center gap-2.5 border-t border-ink-100 bg-surface-muted px-4 py-4 text-sm text-ink-500">
        <Lock className="h-4 w-4 shrink-0 text-ink-400" />
        <span>{disabledReason ?? 'This conversation is closed.'}</span>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      onDragOver={(event) => {
        event.preventDefault();
        if (!dragging) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
      }}
      onDrop={handleDrop}
      className="relative border-t border-ink-100 bg-white p-3 sm:p-4"
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50/90 text-sm font-semibold text-brand-700">
          Drop a photo to attach it
        </div>
      )}

      {photo && (
        <div className="mb-2 flex items-center gap-3 rounded-2xl border border-ink-200 bg-surface-muted p-2 pr-3">
          <img
            src={photo.previewUrl}
            alt="Photo to send"
            className="h-14 w-14 shrink-0 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink-800">{photo.file.name}</p>
            {sending && uploadProgress !== null ? (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-200">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-[11px] tabular-nums text-ink-500">{uploadProgress}%</span>
              </div>
            ) : (
              <p className="text-xs text-ink-500">
                {formatBytes(photo.file.size)} · add a caption below or send as is
              </p>
            )}
          </div>
          {!sending && (
            <button
              type="button"
              onClick={removePhoto}
              aria-label="Remove photo"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-400 transition hover:bg-ink-200 hover:text-ink-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-2xl border border-ink-200 bg-white p-2 transition focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-500/10">
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          className="hidden"
          onChange={(event) => attachPhoto(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          aria-label="Attach a photo"
          title="Attach a photo"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-ink-500 transition hover:bg-brand-50 hover:text-brand-600 disabled:opacity-50"
        >
          <ImagePlus className="h-5 w-5" />
        </button>

        <label htmlFor="message-input" className="sr-only">
          Message
        </label>
        <textarea
          id="message-input"
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={stopTyping}
          placeholder={photo ? 'Add a caption (optional)...' : 'Type a message...'}
          className="max-h-40 min-h-[2.5rem] w-full resize-none bg-transparent px-1 py-2 text-sm text-ink-800 outline-none placeholder:text-ink-400"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label={photo ? 'Send photo' : 'Send message'}
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded-xl transition',
            canSend ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-ink-100 text-ink-400',
          )}
        >
          <SendHorizonal className={cn('h-4 w-4', sending && 'animate-pulse')} />
        </button>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-3 px-1">
        <p className="text-[11px] text-ink-400">
          <kbd className="rounded border border-ink-200 bg-ink-50 px-1 font-sans">Enter</kbd> to send ·{' '}
          <kbd className="rounded border border-ink-200 bg-ink-50 px-1 font-sans">Shift</kbd>+
          <kbd className="rounded border border-ink-200 bg-ink-50 px-1 font-sans">Enter</kbd> new line ·
          paste or drop a photo
        </p>
        {value.length > MAX_LENGTH * 0.8 && (
          <p className="shrink-0 text-[11px] tabular-nums text-ink-400">
            {value.length}/{MAX_LENGTH}
          </p>
        )}
      </div>
    </form>
  );
}

export default MessageInput;
