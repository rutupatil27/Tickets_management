import { useCallback, useEffect, useRef, useState } from 'react';
import ticketApi from '../services/ticketApi.js';
import { useSocket } from './useSocket.js';
import { SOCKET_EVENTS } from '../utils/constants.js';

const EMPTY_PAGINATION = { page: 1, limit: 10, total: 0, totalPages: 1 };

/**
 * Server-driven ticket list: filtering, searching and paging all happen in
 * MongoDB, never in React (spec §69).
 * Also refreshes itself when a live ticket event arrives.
 */
export function useTickets(filters) {
  const { subscribe } = useSocket();
  const [tickets, setTickets] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Serialised filters keep the effect from re-running on every render.
  const key = JSON.stringify(filters);
  const latestRequest = useRef(0);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const requestId = latestRequest.current + 1;
      latestRequest.current = requestId;

      if (!silent) setLoading(true);
      setError(null);

      try {
        const { data } = await ticketApi.list(JSON.parse(key));
        // Ignore a slow response that a newer request has already superseded.
        if (latestRequest.current !== requestId) return;
        setTickets(data.tickets);
        setPagination(data.pagination);
      } catch (err) {
        if (latestRequest.current === requestId) setError(err);
      } finally {
        if (latestRequest.current === requestId) setLoading(false);
      }
    },
    [key],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const refresh = () => load({ silent: true });
    const unsubscribers = [
      subscribe(SOCKET_EVENTS.TICKET_UPDATED, refresh),
      subscribe(SOCKET_EVENTS.TICKET_ASSIGNED, refresh),
      subscribe(SOCKET_EVENTS.TICKET_STATUS_CHANGED, refresh),
    ];
    return () => unsubscribers.forEach((off) => off());
  }, [subscribe, load]);

  return { tickets, pagination, loading, error, reload: load };
}

export default useTickets;
