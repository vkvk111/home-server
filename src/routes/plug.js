'use strict';

const { Router } = require('express');
const { getClient, publish, getPlugData } = require('../services/mqtt');

const router = Router();
getClient(); // ensure subscribed at startup

// GET /api/plug/:id — returns cached telemetry and pings for fresh status
router.get('/:id', (req, res) => {
  const plugId = `plug${req.params.id}`;
  publish(`cmnd/${plugId}/Status`, '0').catch(() => {});
  res.json({ plugId, data: getPlugData(plugId) });
});

// POST /api/plug/:id/power — set power ON or OFF
router.post('/:id/power', async (req, res) => {
  const state = String(req.body.state ?? '').toUpperCase();
  if (!['ON', 'OFF'].includes(state)) {
    return res.status(400).json({ error: 'state must be ON or OFF' });
  }
  try {
    await publish(`cmnd/plug${req.params.id}/Power`, state);
    res.json({ ok: true, state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
