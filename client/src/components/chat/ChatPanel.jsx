import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowDown, MessagesSquare, WifiOff } from 'lucide-react';
import cn from '../../utils/cn.js';
import { MessageBubble, SystemMessage } from './MessageBubble.jsx';
import MessageInput from './MessageInput.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import ImageLightbox from './ImageLightbox.jsx';
import { EmptyState, LoadingState } from '../common/States.jsx';
import ConnectionStatus from '../layout/ConnectionStatus.jsx';
import messageApi from '../../services/messageApi.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useSocket } from '../../hooks/useSocket.js';
import appConfig from '../../config/appConfig.js';
import { formatDayLabel } from '../../utils/format.js';
import { MESSAGE_TYPE_SYSTEM, SOCKET_EVENTS, TICKET_STATUS } from '../../utils/constants.js';

const idOf = (value) => (typeof value === 'object' && value !== null ? value._id : value);

/** Groups the flat message list into day buckets for the date separators. */
function groupByDay(messages) {
  const groups = [];

  messages.forEach((message) => {
    const day = new Date(message.createdAt).toDateString();
    const last = groups.at(-1);
    if (last?.day === day) last.messages.push(message);
    else groups.push({ day, label: formatDayLabel(message.createdAt), messages: [message] });
  });

  return groups;
}

/**
 * The real-time ticket conversation (spec §46/§47).
 *
 * History comes from REST; live delivery, typing and read receipts ride on
 * Socket.IO. Sent messages are NOT rendered optimistically - the server's saved
 * copy is the authoritative one that appears (spec §68).
 */
export function ChatPanel({ ticket, className }) {
  const { user } = useAuth();
  const { socket, isConnected, subscribe, emit } = useSocket();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [openPhoto, setOpenPhoto] = useState(null);
  const closePhoto = useCallback(() => setOpenPhoto(null), []);

  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const typingTimers = useRef(new Map());

  const ticketId = ticket?._id;
  const isClosed = ticket?.status === TICKET_STATUS.CLOSED;

  /* ------------------------------------------------------------ history */
  useEffect(() => {
    if (!ticketId) return undefined;

    let cancelled = false;
    setLoading(true);

    messageApi
      .list(ticketId, { limit: appConfig.chat.messagePageSize, order: 'asc' })
      .then(({ data }) => {
        if (!cancelled) setMessages(data.messages);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  /* --------------------------------------------------------- join room */
  useEffect(() => {
    if (!socket || !isConnected || !ticketId) return undefined;

    emit(SOCKET_EVENTS.TICKET_JOIN, { ticketId }, (ack) => {
      if (!ack?.success) toast.error(ack?.message ?? 'Could not join this conversation');
    });

    // Opening the ticket marks the conversation as read (spec §28).
    emit(SOCKET_EVENTS.TICKET_READ, { ticketId });

    return () => {
      emit(SOCKET_EVENTS.TICKET_LEAVE, { ticketId });
    };
  }, [socket, isConnected, ticketId, emit]);

  /* ------------------------------------------------------- live events */
  useEffect(() => {
    const off = subscribe(SOCKET_EVENTS.TICKET_MESSAGE_NEW, (payload) => {
      if (payload.ticketId !== ticketId) return;

      setMessages((current) => {
        // The socket and a REST response can both deliver the same message.
        if (current.some((message) => message._id === payload.message._id)) return current;
        return [...current, payload.message];
      });

      if (idOf(payload.message.senderId) !== user._id) {
        emit(SOCKET_EVENTS.TICKET_READ, { ticketId });
      }
    });

    return off;
  }, [subscribe, ticketId, user._id, emit]);

  useEffect(() => {
    const off = subscribe(SOCKET_EVENTS.TICKET_READ_UPDATE, (payload) => {
      if (payload.ticketId !== ticketId || payload.userId === user._id) return;

      setMessages((current) =>
        current.map((message) =>
          message.readBy?.includes(payload.userId)
            ? message
            : { ...message, readBy: [...(message.readBy ?? []), payload.userId] },
        ),
      );
    });

    return off;
  }, [subscribe, ticketId, user._id]);

  /* ------------------------------------------------------------ typing */
  useEffect(() => {
    const clearTypingFor = (userId) => {
      setTypingUsers((current) => current.filter((entry) => entry._id !== userId));
      clearTimeout(typingTimers.current.get(userId));
      typingTimers.current.delete(userId);
    };

    const offStart = subscribe(SOCKET_EVENTS.TICKET_TYPING_START, (payload) => {
      if (payload.ticketId !== ticketId || payload.user._id === user._id) return;

      setTypingUsers((current) =>
        current.some((entry) => entry._id === payload.user._id) ? current : [...current, payload.user],
      );

      // Safety net in case the "stop" event is lost.
      clearTimeout(typingTimers.current.get(payload.user._id));
      typingTimers.current.set(
        payload.user._id,
        setTimeout(() => clearTypingFor(payload.user._id), 4000),
      );
    });

    const offStop = subscribe(SOCKET_EVENTS.TICKET_TYPING_STOP, (payload) => {
      if (payload.ticketId !== ticketId) return;
      clearTypingFor(payload.user._id);
    });

    return () => {
      offStart();
      offStop();
      typingTimers.current.forEach(clearTimeout);
      typingTimers.current.clear();
    };
  }, [subscribe, ticketId, user._id]);

  /* ---------------------------------------------------------- scrolling */
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  useEffect(() => {
    if (loading) return;
    const node = scrollRef.current;
    if (!node) return;

    // Only auto-scroll when the reader is already near the bottom, so reading
    // history is not yanked away by an incoming message.
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    if (distanceFromBottom < 220) scrollToBottom(messages.length > 40 ? 'auto' : 'smooth');
  }, [messages, loading, scrollToBottom]);

  useEffect(() => {
    if (!loading) scrollToBottom('auto');
  }, [loading, scrollToBottom]);

  const handleScroll = (event) => {
    const node = event.currentTarget;
    setShowJumpButton(node.scrollHeight - node.scrollTop - node.clientHeight > 320);
  };

  /* ------------------------------------------------------------- send */
  const sendMessage = useCallback(
    async ({ content, file }) => {
      const appendIfMissing = (message) =>
        setMessages((current) =>
          current.some((existing) => existing._id === message._id) ? current : [...current, message],
        );

      setSending(true);
      try {
        // Photos always go over REST (sockets are a poor fit for binary files).
        // The server then broadcasts the saved message to the room, so the other
        // side still receives it live; appending here just covers a dropped socket.
        if (file) {
          setUploadProgress(0);
          const response = await messageApi.sendPhoto(ticketId, { file, content }, setUploadProgress);
          appendIfMissing(response.data.message);
          return true;
        }

        if (isConnected) {
          const ack = await new Promise((resolve) => {
            emit(SOCKET_EVENTS.TICKET_MESSAGE, { ticketId, content }, resolve);
            // Fall back to REST if the server does not acknowledge in time.
            setTimeout(() => resolve(null), 4000);
          });

          if (ack?.success) return true;
          if (ack && !ack.success) {
            toast.error(ack.message ?? 'Message could not be sent');
            return false;
          }
        }

        // Offline or no ack: REST is the same write path, so nothing is lost.
        const response = await messageApi.send(ticketId, content);
        appendIfMissing(response.data.message);
        return true;
      } catch (error) {
        toast.error(error.message);
        return false;
      } finally {
        setSending(false);
        setUploadProgress(null);
      }
    },
    [emit, isConnected, ticketId],
  );

  const dayGroups = useMemo(() => groupByDay(messages), [messages]);

  return (
    <section className={cn('relative flex min-h-0 flex-col overflow-hidden', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <MessagesSquare className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-ink-900">Conversation</h2>
            <p className="text-xs text-ink-400">
              {messages.length} message{messages.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <ConnectionStatus />
      </header>

      {!isConnected && (
        <p className="flex items-center gap-2 border-b border-warning-200 bg-warning-50 px-4 py-2 text-xs font-medium text-warning-700">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          Live updates are paused. Messages you send still reach the server and appear here.
        </p>
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 overflow-y-auto bg-surface-muted/50 px-2 py-4 sm:px-3"
      >
        {loading ? (
          <LoadingState label="Loading conversation..." />
        ) : messages.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No messages yet"
            description="Start the conversation - your agent will be notified straight away."
          />
        ) : (
          <ul className="space-y-3">
            {dayGroups.map((group) => (
              <li key={group.day}>
                <div className="my-3 flex items-center gap-3 px-3">
                  <span className="h-px flex-1 bg-ink-200" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                    {group.label}
                  </span>
                  <span className="h-px flex-1 bg-ink-200" />
                </div>

                <ul className="space-y-3">
                  {group.messages.map((message, index) => {
                    if (message.type === MESSAGE_TYPE_SYSTEM) {
                      return <SystemMessage key={message._id} message={message} />;
                    }

                    const senderId = idOf(message.senderId);
                    const previous = group.messages[index - 1];
                    const isOwn = senderId === user._id;
                    const showAvatar =
                      !previous ||
                      previous.type === MESSAGE_TYPE_SYSTEM ||
                      idOf(previous.senderId) !== senderId;

                    return (
                      <MessageBubble
                        key={message._id}
                        message={message}
                        isOwn={isOwn}
                        showAvatar={showAvatar}
                        isReadByOther={(message.readBy ?? []).some((id) => id !== user._id)}
                        onOpenPhoto={setOpenPhoto}
                      />
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      {showJumpButton && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          className="pointer-events-auto absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink-900/85 px-3 py-1.5 text-xs font-semibold text-white shadow-pop"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          Jump to latest
        </button>
      )}

      <TypingIndicator names={typingUsers.map((entry) => entry.name)} />

      <MessageInput
        onSend={sendMessage}
        sending={sending}
        uploadProgress={uploadProgress}
        disabled={isClosed}
        disabledReason="This ticket is closed. Reopen it to continue the conversation."
        onTypingStart={() => emit(SOCKET_EVENTS.TICKET_TYPING_START, { ticketId })}
        onTypingStop={() => emit(SOCKET_EVENTS.TICKET_TYPING_STOP, { ticketId })}
      />

      <ImageLightbox attachment={openPhoto} onClose={closePhoto} />
    </section>
  );
}

export default ChatPanel;
