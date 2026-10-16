const router = require('express').Router();
const Group = require('../models/Group');
const Settings = require('../models/Settings');
const mailer = require('../services/mailer');
const { fmtRange, fmtDate } = require('../lib/time');

/*
 * Emails every scheduled group that has not been told about its current slot.
 * Moving a group clears notifiedAt, so pressing the button again after a
 * reshuffle only mails the people whose slot changed. { resend: true } mails everyone.
 */
router.post('/', async (req, res) => {
  const settings = await Settings.get();
  const filter = { 'slot.start': { $type: 'number' } };
  if (!req.body.resend) filter.notifiedAt = null;
  const groups = await Group.find(filter).populate('mentor').sort('groupNo');

  const describe = (g) => {
    const panel = settings.panels.id(g.slot.panelId);
    return [
      `Group ${g.groupNo}: ${g.title}`,
      `Date:  ${fmtDate(g.slot.date)}`,
      `Time:  ${fmtRange(g.slot.start, settings.slotMinutes)}`,
      `Panel: ${panel.name}`,
      `Room:  ${panel.room}`,
    ].join('\n');
  };

  let sent = 0;
  const failed = [];
  const deliver = async (to, subject, text) => {
    try {
      await mailer.send({ to, subject, text });
      sent += 1;
      return true;
    } catch (err) {
      failed.push({ to, error: err.message });
      return false;
    }
  };

  const perMentor = new Map();
  for (const g of groups) {
    const key = g.mentor.email;
    if (!perMentor.has(key)) perMentor.set(key, { mentor: g.mentor, groups: [] });
    perMentor.get(key).groups.push(g);

    const to = g.members.map((m) => m.email).filter(Boolean).join(', ');
    if (!to) {
      failed.push({ to: `Group ${g.groupNo}`, error: 'No student email on record' });
      continue;
    }
    const text =
      `Your presentation slot is confirmed.\n\n${describe(g)}\nMentor: ${g.mentor.name}\n\n` +
      'Please be at the room ten minutes early.';
    if (await deliver(to, `${settings.eventName}: Group ${g.groupNo} slot`, text)) {
      g.notifiedAt = new Date();
      await g.save();
    }
  }

  // One mail per mentor listing all of their groups, not one mail per group.
  for (const { mentor, groups: mine } of perMentor.values()) {
    const text = `Dear ${mentor.name},\n\nYour groups present as follows.\n\n${mine.map(describe).join('\n\n')}\n`;
    await deliver(mentor.email, `${settings.eventName}: your groups' slots`, text);
  }

  res.json({ sent, failed, groups: groups.length, live: mailer.live });
});

module.exports = router;
