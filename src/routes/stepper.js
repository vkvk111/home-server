'use strict';

const { Router } = require('express');
const { publish, getDeviceStatus } = require('../services/mqtt');

const router = Router();

const TOPIC = 'cmnd/motor-test/cmd';

// GET /api/stepper/status
router.get('/status', (_req, res) => {
  const d = getDeviceStatus('motor-test');
  const online = d?.status === 'online';
  res.json({ online, status: d?.status ?? 'unknown', lastSeen: d?.lastSeen ?? null });
});

// POST /api/stepper/on
router.post('/on', async (_req, res) => {
  try {
    await publish(TOPIC, '{"on":true}');
    res.json({ ok: true, cmd: 'on' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stepper/off
router.post('/off', async (_req, res) => {
  try {
    await publish(TOPIC, 's');
    res.json({ ok: true, cmd: 'off' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stepper/speed   body: { speed: 150 }
router.post('/speed', async (req, res) => {
  const speed = parseInt(req.body.speed, 10);
  if (!speed || speed < 10 || speed > 1000) {
    return res.status(400).json({ error: 'speed must be between 10 and 1000 steps/s' });
  }
  try {
    await publish(TOPIC, JSON.stringify({ speed }));
    res.json({ ok: true, speed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
