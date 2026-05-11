'use strict';

const { spawn } = require('child_process');
const path = require('path');
const { EventEmitter } = require('events');

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'gpio', 'button_watcher.py');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';

const emitter = new EventEmitter();
let proc = null;
let _ready = false;

function start() {
  if (proc) return;

  proc = spawn(PYTHON_BIN, [SCRIPT], { stdio: ['pipe', 'pipe', 'inherit'] });

  let buf = '';

  proc.stdout.on('data', (chunk) => {
    buf += chunk.toString();
    const lines = buf.split('\n');
    buf = lines.pop(); // keep incomplete trailing line
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.event === 'ready') {
          _ready = true;
          console.log('[button] GPIO watcher ready — LED on, watching BCM' + msg.button);
          emitter.emit('ready');
        } else if (msg.event === 'press') {
          console.log('[button] Button pressed (BCM' + msg.pin + ')');
          emitter.emit('press');
        } else if (msg.event === 'release') {
          emitter.emit('release');
        } else if (msg.event === 'error') {
          console.error('[button] GPIO error:', msg.message);
          emitter.emit('error', new Error(msg.message));
        }
      } catch {
        // ignore non-JSON lines
      }
    }
  });

  proc.on('exit', (code) => {
    console.warn('[button] watcher exited with code', code);
    _ready = false;
    proc = null;
  });
}

function setLed(on) {
  if (proc && proc.stdin.writable) {
    proc.stdin.write(on ? 'LED:1\n' : 'LED:0\n');
  }
}

function blinkLed() {
  if (proc && proc.stdin.writable) {
    proc.stdin.write('LED:BLINK\n');
  }
}

function isReady() {
  return _ready;
}

module.exports = { start, setLed, blinkLed, isReady, emitter };
