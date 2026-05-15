'use strict';

const { Router } = require('express');
const { publish, getDeviceStatus } = require('../services/mqtt');

const router = Router();

const TOPIC = 'cmnd/motor-test/cmd';

// GET /api/stepper/status
router.get('/status', (_req, res) => {
  const d = getDeviceStatus('motor-test');
  const online = d?.status === 'online';
  const ageSecs = d?.lastSeen ? Math.round((Date.now() - d.lastSeen) / 1000) : null;
  res.json({ online, status: d?.status ?? 'unknown', ageSecs });
});

// POST /api/stepper/move   body: { steps: N, dir: 'f'|'b' }
router.post('/move', async (req, res) => {
  const steps = parseInt(req.body.steps, 10);
  const dir = req.body.dir === 'b' ? 'b' : 'f';
  if (!steps || steps < 1 || steps > 999999) {
    return res.status(400).json({ error: 'steps must be 1–999999' });
  }
  try {
    await publish(TOPIC, JSON.stringify({ steps, dir }));
    res.json({ ok: true, steps, dir });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
