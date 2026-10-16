const { Schema, model } = require('mongoose');

const mentorSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  unavailable: [String], // presentation dates the mentor cannot attend
});

module.exports = model('Mentor', mentorSchema);
