import { Check, CheckCheck, Info } from 'lucide-react';
import cn from '../../utils/cn.js';
import Avatar from '../common/Avatar.jsx';
import ChatImage from './ChatImage.jsx';
import { formatTime } from '../../utils/format.js';
import { ROLE_LABELS } from '../../utils/constants.js';

/** Platform-generated timeline entry (assignment, status change, ...). */
export function SystemMessage({ message }) {
  return (
    <li className="flex justify-center px-2 py-1">
      <span className="inline-flex max-w-[38rem] items-start gap-2 rounded-full bg-ink-100 px-3.5 py-1.5 text-center text-xs text-ink-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
        <span className="break-anywhere">{message.content}</span>
      </span>
    </li>
  );
}

export function MessageBubble({ message, isOwn, showAvatar = true, isReadByOther, onOpenPhoto }) {
  const sender = message.senderId;
  const photos = message.attachments ?? [];
  const hasText = Boolean(message.content);

  return (
    <li className={cn('flex gap-2.5 px-1', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      <span className={cn('w-8 shrink-0', !showAvatar && 'invisible')}>
        {showAvatar && <Avatar name={sender?.name ?? 'User'} src={sender?.avatar} size="sm" ring={false} />}
      </span>

      <div className={cn('flex min-w-0 max-w-[min(34rem,80%)] flex-col', isOwn && 'items-end')}>
        {showAvatar && (
          <p className={cn('mb-1 flex items-center gap-1.5 px-1 text-xs', isOwn && 'flex-row-reverse')}>
            <span className="font-semibold text-ink-700">{isOwn ? 'You' : sender?.name}</span>
            <span className="text-ink-400">{ROLE_LABELS[message.senderRole] ?? message.senderRole}</span>
          </p>
        )}

        <div
          className={cn(
            'break-anywhere whitespace-pre-wrap text-sm leading-relaxed shadow-soft',
            // A photo gets a thin frame; plain text keeps the normal padding.
            photos.length ? 'p-1.5' : 'px-3.5 py-2.5',
            isOwn
              ? 'rounded-2xl rounded-br-md bg-brand-600 text-white'
              : 'rounded-2xl rounded-bl-md border border-ink-200/70 bg-white text-ink-800',
          )}
        >
          {photos.map((attachment) => (
            <ChatImage key={attachment.url} attachment={attachment} onOpen={onOpenPhoto} />
          ))}
          {hasText && (
            <p className={cn(photos.length && 'px-2 pb-1 pt-2')}>{message.content}</p>
          )}
        </div>

        <p
          className={cn(
            'mt-1 flex items-center gap-1 px-1 text-[11px] text-ink-400',
            isOwn && 'flex-row-reverse',
          )}
        >
          <span>{formatTime(message.createdAt)}</span>
          {isOwn &&
            (isReadByOther ? (
              <CheckCheck className="h-3.5 w-3.5 text-brand-500" aria-label="Read" />
            ) : (
              <Check className="h-3.5 w-3.5" aria-label="Sent" />
            ))}
        </p>
      </div>
    </li>
  );
}

export default MessageBubble;
