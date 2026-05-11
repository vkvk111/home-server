'use strict';

const { spawn } = require('child_process');
const path = require('path');

const GPIO_SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'gpio', 'gpio_controller.py');
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';

/**
 * Run the GPIO controller script with the given arguments.
 * Resolves with parsed JSON output, rejects on error or non-zero exit.
 * @param {string[]} args
 * @returns {Promise<object>}
 */
function runGpio(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [GPIO_SCRIPT, ...args], {
      timeout: 5000,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.stderr.on('data', (chunk) => { stderr += chunk; });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr.trim() || `gpio_controller exited with code ${code}`));
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error(`Invalid JSON from gpio_controller: ${stdout.trim()}`));
      }
    });

    proc.on('error', reject);
  });
}

module.exports = { runGpio };
