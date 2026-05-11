'use strict';

const { Router } = require('express');
const { spawn } = require('child_process');
const { publish } = require('../services/mqtt');

const router = Router();

function blinkLed() {
  const py = process.env.PYTHON_BIN || 'python3';
  const code = [
    'import RPi.GPIO as GPIO, time',
    'GPIO.setmode(GPIO.BCM)',
    'GPIO.setup(18, GPIO.OUT)',
    'for _ in range(20):',
    '    GPIO.output(18, GPIO.HIGH)',
    '    time.sleep(0.125)',
    '    GPIO.output(18, GPIO.LOW)',
    '    time.sleep(0.125)',
    'GPIO.cleanup()',
  ].join('\n');
  spawn(py, ['-c', code], { detached: true, stdio: 'ignore' }).unref();
}

// POST /api/launch
// Runs the launch sequence: turns plug1001 ON and blinks LED for 5 s
router.post('/', async (_req, res) => {
  try {
    await publish('cmnd/plug1001/Power', 'ON');
    blinkLed();
    res.json({ ok: true, message: 'Launch sequence complete' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
