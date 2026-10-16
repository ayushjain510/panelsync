const router = require('express').Router();
const Mentor = require('../models/Mentor');
const { httpError } = require('../lib/http');

router.get('/', async (req, res) => {
  res.json(await Mentor.find().sort('name'));
});

router.put('/:id', async (req, res) => {
  const { unavailable } = req.body;
  if (!Array.isArray(unavailable)) throw httpError(400, 'unavailable must be a list of dates');
  const mentor = await Mentor.findByIdAndUpdate(req.params.id, { $set: { unavailable } }, { new: true });
  if (!mentor) throw httpError(404, 'Mentor not found');
  res.json(mentor);
});

module.exports = router;
