'use strict';

const { Router } = require('express');
const { publish } = require('../services/mqtt');

const router = Router();

const TOPIC = 'cmnd/motor-test/cmd';

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
