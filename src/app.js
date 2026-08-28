const express = require('express');
const cors = require('cors');
const authRoutes = require('./interfaces/http/routes/authRoutes');
const errorHandler = require('./interfaces/http/middlewares/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);

// Must be registered last -- Express only treats a 4-arg middleware as an
// error handler, and only errors passed to routes/middleware above this
// line will reach it.
app.use(errorHandler);

module.exports = app;
