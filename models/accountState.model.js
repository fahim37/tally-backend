import mongoose from 'mongoose';

const { Schema, model } = mongoose;

export const ACCOUNT_STATE_SECTIONS = [
  'profile',
  'settings',
  'categories',
  'tiles',
  'budgets',
  'habits',
  'goals',
  'recurring',
];

const sectionSchema = new Schema(
  {
    value: { type: Schema.Types.Mixed, required: true },
    revision: { type: Number, required: true, default: 0, min: 0 },
    updatedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const sections = Object.fromEntries(
  ACCOUNT_STATE_SECTIONS.map((name) => [name, { type: sectionSchema, default: undefined }])
);

/**
 * Small, account-scoped state that is not expense history. Each top-level
 * section is versioned independently so an offline budget edit cannot replace
 * a tile or habit changed on another device.
 */
const accountStateSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    sections,
  },
  { timestamps: true, minimize: false }
);

export default model('AccountState', accountStateSchema);
