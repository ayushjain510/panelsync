const crypto = require('crypto');
const { Schema, model } = require('mongoose');

const panelSchema = new Schema({
  name: { type: String, required: true, trim: true },
  room: { type: String, required: true, trim: true },
  members: [{ type: Schema.Types.ObjectId, ref: 'Mentor' }], // faculty evaluating on this panel
  shareToken: { type: String, default: () => crypto.randomBytes(9).toString('base64url') },
});

const settingsSchema = new Schema({
  institution: { type: String, default: '' },
  eventName: { type: String, default: 'Applicative Project Presentation Schedule' },
  dates: [String],
  dayStart: { type: String, default: '09:30' },
  dayEnd: { type: String, default: '16:30' },
  slotMinutes: { type: Number, default: 20, min: 5, max: 240 },
  breaks: [{ _id: false, start: String, end: String }],
  panels: [panelSchema],
});

// The app has exactly one settings document.
settingsSchema.statics.get = async function () {
  return (await this.findOne()) || this.create({});
};

module.exports = model('Settings', settingsSchema);
