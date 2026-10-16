const router = require('express').Router();
const Group = require('../models/Group');
const Settings = require('../models/Settings');

// Read-only schedule for one panel, reachable by anyone holding the link.
// Emails are deliberately left out of the response.
router.get('/panel/:token', async (req, res) => {
  const settings = await Settings.get();
  const panel = settings.panels.find((p) => p.shareToken === req.params.token);
  if (!panel) return res.status(404).json({ message: 'This link is not valid any more' });

  const groups = await Group.find({ 'slot.panelId': panel._id })
    .populate('mentor', 'name')
    .sort({ 'slot.date': 1, 'slot.start': 1 });

  res.json({
    institution: settings.institution,
    eventName: settings.eventName,
    slotMinutes: settings.slotMinutes,
    panel: { name: panel.name, room: panel.room },
    rows: groups.map((g) => ({
      groupNo: g.groupNo,
      title: g.title,
      mentor: g.mentor.name,
      date: g.slot.date,
      start: g.slot.start,
      members: g.members.map((m) => ({ studentId: m.studentId, name: m.name })),
    })),
  });
});

module.exports = router;
