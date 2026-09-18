import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { ROLES, ROLE_VALUES, AVAILABILITY, AVAILABILITY_VALUES } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned unless explicitly requested
    },
    role: {
      type: String,
      enum: ROLE_VALUES,
      default: ROLES.CUSTOMER,
      index: true,
    },
    /** Only meaningful for agents (spec §31). */
    availabilityStatus: {
      type: String,
      enum: AVAILABILITY_VALUES,
      default: AVAILABILITY.OFFLINE,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    avatar: { type: String, default: '' },
    phone: { type: String, default: '', trim: true, maxlength: 20 },
    /**
     * Reserved for the future skill-based routing described in spec §18.
     * Values are ticket categories the agent is good at.
     */
    skills: { type: [String], default: [] },
    lastSeenAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        delete ret.id;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

// Fast lookup of assignable agents for the assignment engine.
userSchema.index({ role: 1, isActive: 1, availabilityStatus: 1 });

userSchema.virtual('initials').get(function initials() {
  return this.name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
});

userSchema.statics.hashPassword = function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, env.BCRYPT_SALT_ROUNDS);
};

userSchema.methods.comparePassword = function comparePassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

export const User = mongoose.model('User', userSchema);

/** Fields safe to send to any authenticated client. */
export const PUBLIC_USER_FIELDS = 'name email role avatar availabilityStatus isActive lastSeenAt createdAt';
