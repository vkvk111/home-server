'use strict';

// ── Router ────────────────────────────────────────────────────────────────────

const routes = {
  dashboard: renderDashboard,
  gpio: renderGpio,
  plug: renderPlug,
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

// ── Utils ─────────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Boot ──────────────────────────────────────────────────────────────────────

navigate(currentPage);


