'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');
const gpioRoutes = require('./routes/gpio');
const systemRoutes = require('./routes/system');
const launchRoutes = require('./routes/launch');
const plugRoutes = require('./routes/plug');

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

// Fallback to SPA index
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const { version } = require('../package.json');
app.listen(PORT, HOST, () => {
  console.log(`Home server v${version} running at http://${HOST}:${PORT}`);
});
