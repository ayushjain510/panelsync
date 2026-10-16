const router = require('express').Router();
const Group = require('../models/Group');
const Settings = require('../models/Settings');
const { toExcel, toPdf } = require('../services/exporter');

const load = async () => [
  await Group.find({ 'slot.start': { $type: 'number' } }).populate('mentor'),
  await Settings.get(),
];

router.get('/xlsx', async (req, res) => {
  const [groups, settings] = await load();
  const buffer = await toExcel(groups, settings);
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.attachment('presentation-schedule.xlsx');
  res.send(Buffer.from(buffer));
});

router.get('/pdf', async (req, res) => {
  const [groups, settings] = await load();
  res.type('application/pdf');
  res.attachment('presentation-schedule.pdf');
  toPdf(groups, settings, res);
});

module.exports = router;
