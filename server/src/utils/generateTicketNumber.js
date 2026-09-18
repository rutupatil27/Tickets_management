import { Counter } from '../models/Counter.js';

const TICKET_SEQUENCE = 'ticketNumber';
const TICKET_PREFIX = 'SD';
const START_AT = 1000;

/**
 * Human readable ticket numbers (SD-1001, SD-1002, ...).
 * Uses an atomic `$inc` on a dedicated counter document so concurrent ticket
 * creation can never produce a duplicate number.
 */
export async function generateTicketNumber() {
  const counter = await Counter.findOneAndUpdate(
    { _id: TICKET_SEQUENCE },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return `${TICKET_PREFIX}-${START_AT + counter.seq}`;
}
