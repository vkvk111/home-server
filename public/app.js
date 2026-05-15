'use strict';

// ── Router ────────────────────────────────────────────────────────────────────

const routes = {
  dashboard: renderDashboard,
  gpio: renderGpio,
  plug: renderPlug,
  stepper: renderStepper,
};

let currentPage = 'dashboard';
let _pollTimer = null;

function navigate(page) {
  clearInterval(_pollTimer);
  _pollTimer = null;
  currentPage = page;
  document.querySelectorAll('.nav-links a').forEach((a) => {
    a.classList.toggle('active', a.dataset.page === page);
  });
  const render = routes[page] ?? renderDashboard;
  render(document.getElementById('app'));
}

document.querySelectorAll('.nav-links a').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    navigate(a.dataset.page);
  });
});

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

// ── Dashboard page ────────────────────────────────────────────────────────────

async function renderDashboard(el) {
  el.innerHTML = `
    <h2>Dashboard</h2>
    <div class="grid" id="sys-grid">
      <div class="card"><div class="card-title">Loading…</div></div>
    </div>
  `;

  try {
    const info = await apiFetch('/api/system/info');
    const usedMb = ((info.memory.total - info.memory.free) / 1024 / 1024).toFixed(0);
    const totalMb = (info.memory.total / 1024 / 1024).toFixed(0);
    const uptimeH = (info.uptime / 3600).toFixed(1);
    const load = info.loadavg[0].toFixed(2);

    document.getElementById('sys-grid').innerHTML = `
      <div class="card">
        <div class="card-title">Hostname</div>
        <div class="card-value">${escHtml(info.hostname)}</div>
      </div>
      <div class="card">
        <div class="card-title">Uptime</div>
        <div class="card-value">${uptimeH} h</div>
      </div>
      <div class="card">
        <div class="card-title">Load avg (1 min)</div>
        <div class="card-value">${load}</div>
      </div>
      <div class="card">
        <div class="card-title">Memory</div>
        <div class="card-value">${usedMb} / ${totalMb} MB</div>
      </div>
    `;
  } catch (err) {
    document.getElementById('sys-grid').innerHTML =
      `<div class="card"><span class="badge badge-err">Error</span> ${escHtml(err.message)}</div>`;
  }
}

// ── GPIO page ─────────────────────────────────────────────────────────────────

function renderGpio(el) {
  el.innerHTML = `
    <h2>GPIO Control</h2>

    <div class="card">
      <div class="card-title">Setup pin direction</div>
      <div class="form-row">
        <div class="form-group">
          <label for="setup-pin">BCM Pin #</label>
          <input id="setup-pin" type="number" min="1" max="27" placeholder="e.g. 17" />
        </div>
        <div class="form-group">
          <label for="setup-dir">Direction</label>
          <select id="setup-dir">
            <option value="OUT">OUT</option>
            <option value="IN">IN</option>
          </select>
        </div>
        <button id="setup-btn">Setup</button>
      </div>
      <pre class="output" id="setup-out">—</pre>
    </div>

    <div class="card">
      <div class="card-title">Read pin</div>
      <div class="form-row">
        <div class="form-group">
          <label for="read-pin">BCM Pin #</label>
          <input id="read-pin" type="number" min="1" max="27" placeholder="e.g. 17" />
        </div>
        <button id="read-btn">Read</button>
      </div>
      <pre class="output" id="read-out">—</pre>
    </div>

    <div class="card">
      <div class="card-title">Write pin</div>
      <div class="form-row">
        <div class="form-group">
          <label for="write-pin">BCM Pin #</label>
          <input id="write-pin" type="number" min="1" max="27" placeholder="e.g. 17" />
        </div>
        <div class="form-group">
          <label for="write-val">Value</label>
          <select id="write-val">
            <option value="1">HIGH (1)</option>
            <option value="0">LOW (0)</option>
          </select>
        </div>
        <button id="write-btn">Write</button>
      </div>
      <pre class="output" id="write-out">—</pre>
    </div>
  `;

  document.getElementById('setup-btn').addEventListener('click', async () => {
    const pin = document.getElementById('setup-pin').value;
    const direction = document.getElementById('setup-dir').value;
    const out = document.getElementById('setup-out');
    try {
      const res = await apiFetch(`/api/gpio/setup/${pin}`, {
        method: 'POST',
        body: JSON.stringify({ direction }),
      });
      out.textContent = JSON.stringify(res, null, 2);
    } catch (err) {
      out.textContent = `Error: ${err.message}`;
    }
  });

  document.getElementById('read-btn').addEventListener('click', async () => {
    const pin = document.getElementById('read-pin').value;
    const out = document.getElementById('read-out');
    try {
      const res = await apiFetch(`/api/gpio/read/${pin}`);
      out.textContent = JSON.stringify(res, null, 2);
    } catch (err) {
      out.textContent = `Error: ${err.message}`;
    }
  });

  document.getElementById('write-btn').addEventListener('click', async () => {
    const pin = document.getElementById('write-pin').value;
    const value = parseInt(document.getElementById('write-val').value, 10);
    const out = document.getElementById('write-out');
    try {
      const res = await apiFetch(`/api/gpio/write/${pin}`, {
        method: 'POST',
        body: JSON.stringify({ value }),
      });
      out.textContent = JSON.stringify(res, null, 2);
    } catch (err) {
      out.textContent = `Error: ${err.message}`;
    }
  });
}

// ── Plug page ─────────────────────────────────────────────────────────────────

function renderPlug(el) {
  el.innerHTML = `
    <h2>Plug Control — plug1001</h2>
    <div class="grid" id="plug-grid">
      <div class="card"><div class="card-title">Loading…</div></div>
    </div>
    <div class="card">
      <div class="card-title">Controls</div>
      <div class="form-row" style="gap:0.75rem;align-items:center;flex-wrap:wrap">
        <button id="plug-on-btn"  class="btn-plug btn-plug-on">ON</button>
        <button id="plug-off-btn" class="btn-plug btn-plug-off">OFF</button>
        <button id="launch-btn"   class="btn-launch">&#9654; Launch Sequence</button>
      </div>
      <pre class="output" id="plug-cmd-out">—</pre>
    </div>
  `;

  async function refresh() {
    try {
      const { data } = await apiFetch('/api/plug/1001');
      const grid = document.getElementById('plug-grid');
      if (!grid) return;
      if (!data) {
        grid.innerHTML = `<div class="card"><span class="badge badge-err">No data</span> Waiting for telemetry from plug1001…</div>`;
        return;
      }
      const state = data.powerState || data.status || '—';
      const stateClass = state === 'ON' ? 'badge-ok' : state === 'OFF' ? 'badge-err' : '';
      const ago = data.lastSeen ? Math.round((Date.now() - data.lastSeen) / 1000) + 's ago' : '—';
      grid.innerHTML = `
        <div class="card">
          <div class="card-title">Status</div>
          <div class="card-value"><span class="badge ${escHtml(stateClass)}">${escHtml(state)}</span></div>
        </div>
        <div class="card">
          <div class="card-title">Voltage</div>
          <div class="card-value">${data.voltage != null ? escHtml(data.voltage) + ' V' : '—'}</div>
        </div>
        <div class="card">
          <div class="card-title">Current</div>
          <div class="card-value">${data.current != null ? escHtml(data.current) + ' A' : '—'}</div>
        </div>
        <div class="card">
          <div class="card-title">Power</div>
          <div class="card-value">${data.power != null ? escHtml(data.power) + ' W' : '—'}</div>
        </div>
        <div class="card">
          <div class="card-title">Power Factor</div>
          <div class="card-value">${data.power_factor != null ? escHtml(data.power_factor) : '—'}</div>
        </div>
        <div class="card">
          <div class="card-title">Energy</div>
          <div class="card-value">${data.energycounter != null ? escHtml(data.energycounter) + ' kWh' : '—'}</div>
        </div>
        <div class="card">
          <div class="card-title">Last seen</div>
          <div class="card-value" style="font-size:1rem">${escHtml(ago)}</div>
        </div>
      `;
    } catch (err) {
      const grid = document.getElementById('plug-grid');
      if (grid) grid.innerHTML = `<div class="card"><span class="badge badge-err">Error</span> ${escHtml(err.message)}</div>`;
    }
  }

  refresh();
  _pollTimer = setInterval(refresh, 3000);

  async function sendPower(state) {
    const out = document.getElementById('plug-cmd-out');
    if (!out) return;
    try {
      const res = await apiFetch('/api/plug/1001/power', { method: 'POST', body: JSON.stringify({ state }) });
      out.textContent = `Power → ${res.state}`;
    } catch (err) {
      out.textContent = `Error: ${escHtml(err.message)}`;
    }
  }

  document.getElementById('plug-on-btn').addEventListener('click', () => sendPower('ON'));
  document.getElementById('plug-off-btn').addEventListener('click', () => sendPower('OFF'));

  document.getElementById('launch-btn').addEventListener('click', async () => {
    const btn = document.getElementById('launch-btn');
    const out = document.getElementById('plug-cmd-out');
    if (!btn || !out) return;
    btn.disabled = true;
    btn.textContent = 'Running…';
    try {
      const res = await apiFetch('/api/launch', { method: 'POST' });
      out.textContent = res.message;
      btn.textContent = '✓ Done';
      setTimeout(() => { btn.disabled = false; btn.innerHTML = '&#9654; Launch Sequence'; }, 2000);
    } catch (err) {
      out.textContent = `Error: ${escHtml(err.message)}`;
      btn.disabled = false;
      btn.innerHTML = '&#9654; Launch Sequence';
    }
  });
}

// ── Stepper page ──────────────────────────────────────────────────────────────

function renderStepper(el) {
  el.innerHTML = `
    <h2>Stepper Motor — motor-test</h2>

    <div class="card" style="margin-bottom:0.75rem">
      <div class="card-title">ESP Status</div>
      <span id="esp-status-badge" class="badge">checking…</span>
      <span id="esp-status-age" style="font-size:0.78rem;color:var(--text-muted,#888);margin-left:0.5rem"></span>
    </div>

    <div class="card">
      <div class="card-title">Motor control — <span id="step-state-badge" class="badge">—</span></div>

      <div style="margin-bottom:0.9rem">
        <div style="font-size:0.82rem;color:var(--text-muted,#888);margin-bottom:0.4rem">Auto-cycle (continuous back and forth)</div>
        <div class="form-row" style="gap:0.75rem">
          <button id="step-on-btn"  class="btn-plug btn-plug-on">ON</button>
          <button id="step-off-btn" class="btn-plug btn-plug-off">OFF</button>
        </div>
      </div>

      <hr style="border:none;border-top:1px solid var(--border,#333);margin:0.75rem 0">

      <div>
        <div style="font-size:0.82rem;color:var(--text-muted,#888);margin-bottom:0.4rem">
          Move N steps &nbsp;
          <button class="step-preset" data-n="200"   style="margin:0 2px">200</button>
          <button class="step-preset" data-n="400"   style="margin:0 2px">400</button>
          <button class="step-preset" data-n="800"   style="margin:0 2px">800</button>
          <button class="step-preset" data-n="3200"  style="margin:0 2px">3200</button>
          <button class="step-preset" data-n="99999" style="margin:0 2px">∞</button>
        </div>
        <div class="form-row" style="gap:0.75rem;align-items:center;flex-wrap:wrap">
          <input id="steps-input" type="number" min="1" max="999999" value="400" style="width:90px" />
          <span style="font-size:0.85rem">steps</span>
        </div>
        <div class="form-row" style="gap:0.75rem;margin-top:0.6rem;flex-wrap:wrap">
          <button id="step-back-btn" style="min-width:90px">◄ Back</button>
          <button id="step-stop-btn" style="min-width:90px">■ Stop</button>
          <button id="step-fwd-btn"  style="min-width:90px">Fwd ►</button>
        </div>
      </div>

      <pre class="output" id="step-cmd-out" style="margin-top:0.75rem">—</pre>
    </div>

    <div class="card">
      <div class="card-title">Speed — <span id="speed-label">150</span> steps/s</div>
      <p style="font-size:0.85rem;color:var(--text-muted,#888);margin:0 0 0.75rem">
        Lower speed = higher torque (less back-EMF).<br>
        Microstepping (MS1/MS2/MS3 pins) also affects torque: full step = maximum.
      </p>
      <div class="form-row" style="align-items:center;gap:0.75rem;flex-wrap:wrap">
        <span style="font-size:0.8rem;white-space:nowrap">10</span>
        <input id="speed-slider" type="range" min="10" max="1000" step="10" value="150"
               style="flex:1;min-width:140px;max-width:340px" />
        <span style="font-size:0.8rem;white-space:nowrap">1000</span>
        <input id="speed-number" type="number" min="10" max="1000" step="10" value="150"
               style="width:80px" />
        <button id="speed-set-btn">Set speed</button>
      </div>
      <div style="margin-top:0.5rem;font-size:0.8rem;color:var(--text-muted,#888)">
        Presets:
        <button class="speed-preset" data-spd="50"  style="margin:0 4px">50</button>
        <button class="speed-preset" data-spd="100" style="margin:0 4px">100</button>
        <button class="speed-preset" data-spd="150" style="margin:0 4px">150</button>
        <button class="speed-preset" data-spd="200" style="margin:0 4px">200</button>
        <button class="speed-preset" data-spd="300" style="margin:0 4px">300</button>
        <button class="speed-preset" data-spd="500" style="margin:0 4px">500</button>
      </div>
    </div>
  `;

  const sliderEl  = document.getElementById('speed-slider');
  const numberEl  = document.getElementById('speed-number');
  const labelEl   = document.getElementById('speed-label');
  const outEl     = document.getElementById('step-cmd-out');
  const badgeEl   = document.getElementById('step-state-badge');
  const stepsEl   = document.getElementById('steps-input');

  let motorOn = false;

  function setBadge(on) {
    motorOn = on;
    badgeEl.textContent = on ? 'RUNNING' : 'STOPPED';
    badgeEl.className   = 'badge ' + (on ? 'badge-ok' : 'badge-err');
  }

  function syncControls(val) {
    sliderEl.value = val;
    numberEl.value = val;
    labelEl.textContent = val;
  }

  sliderEl.addEventListener('input', () => syncControls(sliderEl.value));
  numberEl.addEventListener('change', () => {
    let v = Math.min(1000, Math.max(10, parseInt(numberEl.value, 10) || 150));
    syncControls(v);
  });

  document.querySelectorAll('.speed-preset').forEach((btn) => {
    btn.addEventListener('click', () => syncControls(btn.dataset.spd));
  });

  document.querySelectorAll('.step-preset').forEach((btn) => {
    btn.addEventListener('click', () => { stepsEl.value = btn.dataset.n; });
  });

  async function sendOn() {
    try {
      await apiFetch('/api/stepper/on', { method: 'POST' });
      setBadge(true);
      outEl.textContent = 'Motor ON — auto-cycling';
    } catch (err) {
      outEl.textContent = 'Error: ' + escHtml(err.message);
    }
  }

  async function sendOff() {
    try {
      await apiFetch('/api/stepper/off', { method: 'POST' });
      setBadge(false);
      outEl.textContent = 'Motor stopped';
    } catch (err) {
      outEl.textContent = 'Error: ' + escHtml(err.message);
    }
  }

  async function sendMove(dir) {
    const steps = Math.min(999999, Math.max(1, parseInt(stepsEl.value, 10) || 400));
    stepsEl.value = steps;
    try {
      await apiFetch('/api/stepper/move', {
        method: 'POST',
        body: JSON.stringify({ steps, dir }),
      });
      setBadge(true);
      const label = steps >= 99999 ? '∞' : steps;
      outEl.textContent = `Moving ${dir === 'f' ? 'forward' : 'backward'} ${label} steps`;
    } catch (err) {
      outEl.textContent = 'Error: ' + escHtml(err.message);
    }
  }

  async function sendSpeed() {
    const spd = parseInt(sliderEl.value, 10);
    try {
      await apiFetch('/api/stepper/speed', {
        method: 'POST',
        body: JSON.stringify({ speed: spd }),
      });
      outEl.textContent = `Speed set to ${spd} steps/s`;
    } catch (err) {
      outEl.textContent = 'Error: ' + escHtml(err.message);
    }
  }

  document.getElementById('step-on-btn').addEventListener('click', sendOn);
  document.getElementById('step-off-btn').addEventListener('click', sendOff);
  document.getElementById('step-fwd-btn').addEventListener('click', () => sendMove('f'));
  document.getElementById('step-back-btn').addEventListener('click', () => sendMove('b'));
  document.getElementById('step-stop-btn').addEventListener('click', sendOff);
  document.getElementById('speed-set-btn').addEventListener('click', sendSpeed);
  sliderEl.addEventListener('change', sendSpeed);

  // ── ESP online/offline indicator ──────────────────────────────────────────
  const espBadge = document.getElementById('esp-status-badge');
  const espAge   = document.getElementById('esp-status-age');

  async function pollEspStatus() {
    try {
      const d = await apiFetch('/api/stepper/status');
      espBadge.textContent = d.online ? 'ONLINE' : (d.status === 'unknown' ? 'UNKNOWN' : 'OFFLINE');
      espBadge.className   = 'badge ' + (d.online ? 'badge-ok' : 'badge-err');
      if (d.ageSecs !== null && d.ageSecs !== undefined) {
        espAge.textContent = d.ageSecs < 10 ? 'just now' : `${d.ageSecs}s ago`;
      } else {
        espAge.textContent = '';
      }
    } catch {
      espBadge.textContent = 'ERROR';
      espBadge.className   = 'badge badge-err';
    }
  }

  pollEspStatus();
  _pollTimer = setInterval(pollEspStatus, 5000);
}



function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Boot ──────────────────────────────────────────────────────────────────────

navigate(currentPage);


