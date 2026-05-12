'use strict';

const { Router } = require('express');
const { publish } = require('../services/mqtt');

const router = Router();

const VALID_EFFECTS = ['off', 'solid', 'rainbow', 'chase', 'pulse'];

// POST /api/leds/:id
// Body: { effect, r, g, b, speed }
// Publishes to cmnd/leds/<id>
router.post('/:id', async (req, res) => {
  const { id } = req.params;
  const { effect, r, g, b, speed } = req.body;

  if (!effect || !VALID_EFFECTS.includes(effect)) {
    return res.status(400).json({ error: `effect must be one of: ${VALID_EFFECTS.join(', ')}` });
  }

  const payload = JSON.stringify({
    effect,
    ...(r    != null && { r:     Math.min(255, Math.max(0, parseInt(r, 10)))     }),
    ...(g    != null && { g:     Math.min(255, Math.max(0, parseInt(g, 10)))     }),
    ...(b    != null && { b:     Math.min(255, Math.max(0, parseInt(b, 10)))     }),
    ...(speed != null && { speed: Math.min(200, Math.max(1, parseInt(speed, 10))) }),
  });

  try {
    await publish(`cmnd/leds/${id}`, payload);
    res.json({ ok: true, id, payload: JSON.parse(payload) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
