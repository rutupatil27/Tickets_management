import { z } from 'zod';
import { paginationQuery } from './common.js';

export const listNotificationsQuerySchema = z
  .object({
    ...paginationQuery,
    isRead: z.enum(['true', 'false']).optional(),
  })
  .strip();
