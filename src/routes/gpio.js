'use strict';

const express = require('express');
const { runGpio } = require('../services/gpio');

const router = express.Router();

// GET /api/gpio/read/:pin  — read digital value of a pin
router.get('/read/:pin', async (req, res) => {
  const pin = parseInt(req.params.pin, 10);
  if (isNaN(pin)) return res.status(400).json({ error: 'Invalid pin number' });

  try {
    const result = await runGpio(['read', String(pin)]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gpio/write/:pin  — write digital value to a pin
// Body: { "value": 0 | 1 }
router.post('/write/:pin', async (req, res) => {
  const pin = parseInt(req.params.pin, 10);
  const value = req.body.value;

  if (isNaN(pin)) return res.status(400).json({ error: 'Invalid pin number' });
  if (value !== 0 && value !== 1) return res.status(400).json({ error: 'value must be 0 or 1' });

  try {
    const result = await runGpio(['write', String(pin), String(value)]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gpio/setup/:pin  — configure pin direction
// Body: { "direction": "IN" | "OUT" }
router.post('/setup/:pin', async (req, res) => {
  const pin = parseInt(req.params.pin, 10);
  const direction = req.body.direction;

  if (isNaN(pin)) return res.status(400).json({ error: 'Invalid pin number' });
  if (!['IN', 'OUT'].includes(direction)) return res.status(400).json({ error: 'direction must be IN or OUT' });

  try {
    const result = await runGpio(['setup', String(pin), direction]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
