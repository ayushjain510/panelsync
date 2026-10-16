const { Schema, model } = require('mongoose');

const slotSchema = new Schema(
  {
    panelId: { type: Schema.Types.ObjectId, required: true },
    date: { type: String, required: true },
    start: { type: Number, required: true },
  },
  { _id: false }
);

const groupSchema = new Schema(
  {
    groupNo: { type: Number, required: true, unique: true, min: 1 },
    title: { type: String, required: true, trim: true },
    mentor: { type: Schema.Types.ObjectId, ref: 'Mentor', required: true },
    members: [
      {
        _id: false,
        studentId: { type: String, required: true, trim: true },
        name: { type: String, required: true, trim: true },
        email: { type: String, trim: true, lowercase: true },
      },
    ],
    slot: { type: slotSchema, default: undefined },
    locked: { type: Boolean, default: false }, // pinned by the coordinator; auto-scheduling leaves it alone
    notifiedAt: Date,
  },
  { timestamps: true }
);

// One group per panel per slot, enforced by the database itself. Each panel
// owns one room, so this is also what makes a room clash impossible to store.
groupSchema.index(
  { 'slot.panelId': 1, 'slot.date': 1, 'slot.start': 1 },
  { unique: true, partialFilterExpression: { 'slot.start': { $type: 'number' } } }
);

module.exports = model('Group', groupSchema);
