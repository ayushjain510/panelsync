const router = require('express').Router();
const Settings = require('../models/Settings');
const Group = require('../models/Group');
const { httpError } = require('../lib/http');
const { toMin } = require('../lib/time');

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

router.get('/', async (req, res) => {
  res.json(await Settings.get());
});

router.put('/', async (req, res) => {
  const b = req.body;
  const dates = [...new Set(b.dates || [])].sort();
  const breaks = (b.breaks || []).filter((x) => x.start && x.end);
  const panels = b.panels || [];

  if (dates.some((d) => !DATE.test(d))) throw httpError(400, 'Dates must look like 2026-11-10');
  if (!HHMM.test(b.dayStart) || !HHMM.test(b.dayEnd) || toMin(b.dayStart) >= toMin(b.dayEnd)) {
    throw httpError(400, 'Working hours need a start time earlier than the end time');
  }
  for (const x of breaks) {
    if (!HHMM.test(x.start) || !HHMM.test(x.end) || toMin(x.start) >= toMin(x.end)) {
      throw httpError(400, 'Each break needs a start time earlier than its end time');
    }
  }
  if (panels.some((p) => !p.name?.trim() || !p.room?.trim())) {
    throw httpError(400, 'Every panel needs a name and a room');
  }
  const rooms = panels.map((p) => p.room.trim().toLowerCase());
  if (new Set(rooms).size !== rooms.length) {
    throw httpError(400, 'Two panels cannot use the same room');
  }
  const seated = panels.flatMap((p) => p.members || []).map(String);
  if (new Set(seated).size !== seated.length) {
    throw httpError(400, 'A faculty member can sit on only one panel');
  }

  const settings = await Settings.get();
  settings.set({
    institution: b.institution || '',
    eventName: b.eventName || '',
    dates,
    dayStart: b.dayStart,
    dayEnd: b.dayEnd,
    slotMinutes: b.slotMinutes,
    breaks,
    // Existing panels keep their id and public link; the client cannot overwrite the token.
    panels: panels.map((p) => {
      const old = p._id && settings.panels.id(p._id);
      const next = { name: p.name, room: p.room, members: p.members || [] };
      if (old) Object.assign(next, { _id: old._id, shareToken: old.shareToken });
      return next;
    }),
  });
  await settings.save();

  // Groups that were sitting in a panel that has just been removed go back to the tray.
  await Group.updateMany(
    { 'slot.start': { $type: 'number' }, 'slot.panelId': { $nin: settings.panels.map((p) => p._id) } },
    { $unset: { slot: 1, notifiedAt: 1 }, $set: { locked: false } }
  );
  res.json(settings);
});

module.exports = router;
