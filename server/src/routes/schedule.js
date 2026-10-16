const router = require('express').Router();
const Group = require('../models/Group');
const Settings = require('../models/Settings');
const { httpError } = require('../lib/http');
const { buildGrid } = require('../lib/time');
const { generateSchedule } = require('../services/scheduler');
const { findIssues, toPlain } = require('../services/conflicts');

const HAS_SLOT = { 'slot.start': { $type: 'number' } };

// Everything the board and the dashboard need, in one request.
router.get('/', async (req, res) => {
  const settings = await Settings.get();
  const groups = await Group.find().populate('mentor').sort('groupNo');
  res.json({
    settings,
    grid: buildGrid(settings),
    groups,
    issues: findIssues(groups.map(toPlain), settings),
  });
});

// Re-plans every group that is not pinned. Pinned groups keep their slot and
// the engine schedules around them.
router.post('/generate', async (req, res) => {
  const settings = await Settings.get();
  const groups = (await Group.find().populate('mentor')).map(toPlain);
  const before = new Map(groups.map((g) => [g.id, g.slot]));
  const result = generateSchedule(groups, settings);

  // Clear first, then write: otherwise a group moving into a slot that another
  // group is about to leave would trip the unique index.
  await Group.updateMany({ $or: [{ locked: false }, { slot: { $exists: false } }] }, { $unset: { slot: 1 } });
  if (result.placements.length) {
    await Group.bulkWrite(
      result.placements.map(({ id, ...slot }) => {
        const old = before.get(id);
        const same = old && old.panelId === slot.panelId && old.date === slot.date && old.start === slot.start;
        const update = { $set: { slot } };
        if (!same) update.$unset = { notifiedAt: 1 }; // a changed slot needs a fresh email
        return { updateOne: { filter: { _id: id }, update } };
      })
    );
  }
  res.json({ placed: result.placements.length, unplaced: result.unplaced, capacity: result.capacity });
});

/*
 * Manual override. Dropping on an empty cell moves the group; dropping on an
 * occupied cell swaps the two. The move is tried on an in-memory draft first.
 * If it would double-book anyone the answer is 409 with the reasons, and
 * nothing is saved unless the coordinator repeats the request with force: true.
 */
router.post('/move', async (req, res) => {
  const { groupId, panelId, date, start, force } = req.body;
  const settings = await Settings.get();
  const groups = await Group.find().populate('mentor');

  const inGrid =
    settings.panels.id(panelId) && settings.dates.includes(date) && buildGrid(settings).includes(start);
  if (!inGrid) throw httpError(400, 'That slot does not exist in the current setup');

  const draft = groups.map(toPlain);
  const moving = draft.find((g) => g.id === groupId);
  if (!moving) throw httpError(404, 'Group not found');
  const target = { panelId: String(panelId), date, start };
  const occupant = draft.find(
    (g) => g.id !== groupId && g.slot && g.slot.panelId === target.panelId && g.slot.date === date && g.slot.start === start
  );
  const origin = moving.slot;

  moving.slot = target;
  if (occupant) occupant.slot = origin;
  const touched = [moving.id, occupant && occupant.id];
  const conflicts = findIssues(draft, settings).filter(
    (i) => i.severity === 'error' && i.groupIds.some((id) => touched.includes(id))
  );
  if (conflicts.length && !force) {
    throw httpError(409, 'This move creates a clash', { conflicts });
  }

  if (occupant) await Group.updateOne({ _id: occupant.id }, { $unset: { slot: 1, notifiedAt: 1 } });
  await Group.updateOne(
    { _id: moving.id },
    { $set: { slot: target, locked: true }, $unset: { notifiedAt: 1 } }
  );
  if (occupant && origin) {
    await Group.updateOne({ _id: occupant.id }, { $set: { slot: origin, locked: true } });
  }
  res.json({ ok: true, swappedWith: occupant ? occupant.groupNo : null });
});

router.post('/unassign', async (req, res) => {
  await Group.updateOne(
    { _id: req.body.groupId },
    { $unset: { slot: 1, notifiedAt: 1 }, $set: { locked: false } }
  );
  res.json({ ok: true });
});

router.post('/lock', async (req, res) => {
  await Group.updateOne({ _id: req.body.groupId, ...HAS_SLOT }, { $set: { locked: Boolean(req.body.locked) } });
  res.json({ ok: true });
});

router.delete('/', async (req, res) => {
  await Group.updateMany({}, { $unset: { slot: 1, notifiedAt: 1 }, $set: { locked: false } });
  res.json({ ok: true });
});

module.exports = router;
