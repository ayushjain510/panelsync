require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

for (const name of ['MONGODB_URI', 'JWT_SECRET', 'ADMIN_PASSWORD']) {
  if (!process.env[name]) {
    console.error(`Missing ${name}. Copy server/.env.example to server/.env and fill it in.`);
    process.exit(1);
  }
}

const { login, requireAuth } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.post('/api/auth/login', login);
app.use('/api/public', require('./routes/public'));

app.use('/api', requireAuth);
app.use('/api/groups', require('./routes/groups'));
app.use('/api/mentors', require('./routes/mentors'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/export', require('./routes/export'));
app.use('/api/notify', require('./routes/notify'));

// In production the same process serves the built React app.
const dist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || '';
    const message = field.startsWith('slot')
      ? 'That slot was just taken. Refresh and try again.'
      : `Duplicate value for ${field}`;
    return res.status(409).json({ message });
  }
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Server error', ...err.body });
});

const port = process.env.PORT || 4000;
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => app.listen(port, () => console.log(`PanelSync API on :${port}`)))
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });
