'use strict';

const { Router } = require('express');
const { publish } = require('../services/mqtt');

const router = Router();

// POST /api/launch
// Runs the launch sequence: turns plug1001 OFF (test)
router.post('/', async (_req, res) => {
  try {
    await publish('cmnd/plug1001/Power', 'OFF');
    res.json({ ok: true, message: 'Launch sequence complete' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
