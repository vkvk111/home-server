'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const gpioRoutes = require('./routes/gpio');
const systemRoutes = require('./routes/system');
const launchRoutes = require('./routes/launch');
const plugRoutes = require('./routes/plug');
const ledsRoutes = require('./routes/leds');
const stepperRoutes = require('./routes/stepper');
const button = require('./services/button');
const { publish } = require('./services/mqtt');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.json());

// Static SPA
app.use(express.static(path.join(__dirname, '..', 'public')));

// API routes
app.use('/api/gpio', gpioRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/launch', launchRoutes);
app.use('/api/plug', plugRoutes);
app.use('/api/leds', ledsRoutes);
app.use('/api/stepper', stepperRoutes);

// Fallback to SPA index
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Button GPIO ───────────────────────────────────────────────────────────────
button.start();

button.emitter.on('press', async () => {
  try {
    await publish('cmnd/plug1001/Power', 'ON');
    console.log('[button] Launch sequence triggered');
    button.blinkLed();
  } catch (err) {
    console.error('[button] Launch failed:', err.message);
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const { version } = require('../package.json');
app.listen(PORT, HOST, () => {
  console.log(`Home server v${version} running at http://${HOST}:${PORT}`);
});
