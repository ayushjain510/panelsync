const router = require('express').Router();
const Group = require('../models/Group');
const Mentor = require('../models/Mentor');
const { httpError } = require('../lib/http');

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Mentors are identified by email, so the same person typed twice stays one record.
async function upsertMentor(name, email) {
  name = String(name || '').trim();
  email = String(email || '').trim().toLowerCase();
  if (!name || !email) throw httpError(400, 'Mentor name and email are required');
  return Mentor.findOneAndUpdate({ email }, { $set: { name } }, { upsert: true, new: true });
}

function cleanMembers(members) {
  const list = (members || [])
    .map((m) => ({
      studentId: String(m.studentId || '').trim(),
      name: String(m.name || '').trim(),
      email: String(m.email || '').trim(),
    }))
    .filter((m) => m.studentId || m.name);
  if (!list.length) throw httpError(400, 'A group needs at least one student');
  return list;
}

// ?q= matches group number, title, student ID, student name or mentor name.
router.get('/', async (req, res) => {
  const { q, panel, status } = req.query;
  const filter = {};
  if (panel) filter['slot.panelId'] = panel;
  if (status === 'scheduled') filter['slot.start'] = { $type: 'number' };
  if (status === 'unscheduled') filter.slot = { $exists: false };

  if (q && q.trim()) {
    const rx = new RegExp(escapeRx(q.trim()), 'i');
    const mentorIds = await Mentor.find({ name: rx }).distinct('_id');
    filter.$or = [
      { title: rx },
      { 'members.studentId': rx },
      { 'members.name': rx },
      { mentor: { $in: mentorIds } },
    ];
    if (/^\d+$/.test(q.trim())) filter.$or.push({ groupNo: Number(q) });
  }
  res.json(await Group.find(filter).populate('mentor').sort('groupNo'));
});

router.post('/', async (req, res) => {
  const { groupNo, title, mentorName, mentorEmail, members } = req.body;
  const mentor = await upsertMentor(mentorName, mentorEmail);
  const group = await Group.create({ groupNo, title, mentor: mentor._id, members: cleanMembers(members) });
  res.status(201).json(await group.populate('mentor'));
});

router.put('/:id', async (req, res) => {
  const { groupNo, title, mentorName, mentorEmail, members } = req.body;
  const group = await Group.findById(req.params.id);
  if (!group) throw httpError(404, 'Group not found');
  const mentor = await upsertMentor(mentorName, mentorEmail);
  Object.assign(group, { groupNo, title, mentor: mentor._id, members: cleanMembers(members) });
  await group.save();
  res.json(await group.populate('mentor'));
});

router.delete('/:id', async (req, res) => {
  await Group.findByIdAndDelete(req.params.id);
  res.status(204).end();
});

/*
 * Bulk intake. The client parses the CSV and posts one object per student:
 *   { groupNo, title, mentorName, mentorEmail, studentId, studentName, studentEmail }
 * Every row is validated before anything is written, so a bad file changes nothing.
 * Re-importing a group updates its details and keeps its slot.
 */
router.post('/import', async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  const errors = [];
  const byNo = new Map();
  const seenStudent = new Map();

  rows.forEach((r, i) => {
    const line = i + 2; // +1 for the header row, +1 because spreadsheets count from 1
    const fail = (message) => errors.push({ line, message });
    const groupNo = Number(r.groupNo);
    const studentId = String(r.studentId || '').trim();
    if (!Number.isInteger(groupNo) || groupNo < 1) return fail('groupNo must be a positive whole number');
    if (!studentId || !String(r.studentName || '').trim()) return fail('studentId and studentName are required');
    if (seenStudent.has(studentId) && seenStudent.get(studentId) !== groupNo) {
      return fail(`Student ${studentId} is already in group ${seenStudent.get(studentId)}`);
    }
    seenStudent.set(studentId, groupNo);

    let g = byNo.get(groupNo);
    if (!g) {
      if (!r.title || !r.mentorName || !r.mentorEmail) {
        return fail('The first row of a group needs title, mentorName and mentorEmail');
      }
      g = { groupNo, title: r.title, mentorName: r.mentorName, mentorEmail: r.mentorEmail, members: [] };
      byNo.set(groupNo, g);
    } else if (r.mentorEmail && r.mentorEmail.trim().toLowerCase() !== g.mentorEmail.trim().toLowerCase()) {
      return fail(`Group ${groupNo} lists two different mentors`);
    }
    g.members.push({ studentId, name: r.studentName, email: r.studentEmail });
  });

  if (!rows.length) throw httpError(400, 'The file has no data rows');
  if (errors.length) {
    throw httpError(400, 'Nothing was imported. Fix these rows and upload the file again.', { errors });
  }

  for (const g of byNo.values()) {
    const mentor = await upsertMentor(g.mentorName, g.mentorEmail);
    await Group.findOneAndUpdate(
      { groupNo: g.groupNo },
      { $set: { title: g.title, mentor: mentor._id, members: cleanMembers(g.members) } },
      { upsert: true, runValidators: true }
    );
  }
  res.json({ imported: byNo.size });
});

module.exports = router;
