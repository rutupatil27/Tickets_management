import mongoose from 'mongoose';
import {
  TICKET_STATUS,
  TICKET_STATUS_VALUES,
  TICKET_PRIORITY,
  TICKET_PRIORITY_VALUES,
  TICKET_CATEGORIES,
  ACTIVE_TICKET_STATUSES,
  PRIORITY_WEIGHT,
} from '../config/constants.js';

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
      trim: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      minlength: 5,
      maxlength: 140,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: 10,
      maxlength: 5000,
    },
    category: {
      type: String,
      required: true,
      enum: TICKET_CATEGORIES,
      index: true,
    },
    priority: {
      type: String,
      enum: TICKET_PRIORITY_VALUES,
      default: TICKET_PRIORITY.MEDIUM,
      index: true,
    },
    /**
     * Numeric mirror of `priority`, kept in sync by the hook below.
     * Needed because the waiting queue must sort URGENT > HIGH > MEDIUM > LOW
     * (spec §17) and a plain string sort cannot express that ordering.
     */
    priorityWeight: {
      type: Number,
      default: PRIORITY_WEIGHT[TICKET_PRIORITY.MEDIUM],
      index: true,
    },
    status: {
      type: String,
      enum: TICKET_STATUS_VALUES,
      default: TICKET_STATUS.OPEN,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    assignedAt: { type: Date, default: null },
    firstResponseAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    reopenedAt: { type: Date, default: null },
    lastMessageAt: { type: Date, default: null },

    reopenCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        delete ret.id;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

// Ticket list is always filtered + sorted, these cover the common access paths.
ticketSchema.index({ createdBy: 1, status: 1, updatedAt: -1 });
ticketSchema.index({ assignedTo: 1, status: 1, updatedAt: -1 });
// Waiting-queue drain: highest priority first, oldest first within a priority.
ticketSchema.index({ status: 1, assignedTo: 1, priorityWeight: -1, createdAt: 1 });

ticketSchema.pre('validate', function syncPriorityWeight(next) {
  if (this.isModified('priority') || this.isNew) {
    this.priorityWeight = PRIORITY_WEIGHT[this.priority] ?? PRIORITY_WEIGHT.MEDIUM;
  }
  next();
});

ticketSchema.virtual('isActive').get(function isActiveTicket() {
  return ACTIVE_TICKET_STATUSES.includes(this.status);
});

/** Room name used by Socket.IO (spec §21). */
ticketSchema.virtual('roomName').get(function roomName() {
  return `ticket:${this._id.toString()}`;
});

export const Ticket = mongoose.model('Ticket', ticketSchema);

export const ticketRoom = (ticketId) => `ticket:${ticketId.toString()}`;
