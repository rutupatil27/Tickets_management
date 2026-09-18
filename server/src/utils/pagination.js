import { PAGINATION } from '../config/constants.js';

export function resolvePagination({ page, limit } = {}) {
  const parsedPage = Number.parseInt(page ?? '', 10);
  const parsedLimit = Number.parseInt(limit ?? '', 10);

  const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : PAGINATION.DEFAULT_PAGE;
  const safeLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, PAGINATION.MAX_LIMIT)
    : PAGINATION.DEFAULT_LIMIT;

  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

export function buildPaginationMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}

/** Escapes user input before it is used inside a RegExp for search. */
export function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
