import mongoose from 'mongoose';
import { ASSIGNED_BY_TYPE, ASSIGNMENT_REASON } from '../config/constants.js';

/**
 * Audit trail for every assignment decision (spec §19 / §35).
 * `assignedByType` distinguishes an automatic SYSTEM assignment from an
 * ADMIN override; `assignedBy` holds the admin's id in the latter case.
 */
const assignmentHistorySchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
      index: true,
    },
    previousAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    newAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedByType: {
      type: String,
      enum: Object.values(ASSIGNED_BY_TYPE),
      default: ASSIGNED_BY_TYPE.SYSTEM,
    },
    reason: {
      type: String,
      enum: Object.values(ASSIGNMENT_REASON),
      required: true,
    },
    /** Snapshot of the workload numbers the decision was based on. */
    workloadSnapshot: {
      type: [
        {
          _id: false,
          agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          activeTickets: Number,
        },
      ],
      default: [],
    },
    note: { type: String, default: '', maxlength: 300 },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

assignmentHistorySchema.index({ ticketId: 1, createdAt: -1 });

export const AssignmentHistory = mongoose.model('AssignmentHistory', assignmentHistorySchema);
