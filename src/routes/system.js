'use strict';

const express = require('express');
const os = require('os');

const router = express.Router();

// GET /api/system/info — basic system info
router.get('/info', (_req, res) => {
  res.json({
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptime: os.uptime(),
    loadavg: os.loadavg(),
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
    },
  });
});

module.exports = router;
