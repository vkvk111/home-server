'use strict';

// ── Router ────────────────────────────────────────────────────────────────────

const routes = {
  dashboard: renderDashboard,
  gpio: renderGpio,
  launch: renderLaunch,
};

let currentPage = 'dashboard';

function navigate(page) {
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

// ── Launch page ──────────────────────────────────────────────────────────────

function renderLaunch(el) {
  el.innerHTML = `
    <h2>Launch Sequence</h2>
    <div class="card launch-card">
      <div class="card-title">Smart Plug Control</div>
      <p class="launch-desc">Sends the launch sequence command to plug1001 via MQTT.</p>
      <button id="launch-btn" class="btn-launch">&#9654; Run Launch Sequence</button>
      <pre class="output" id="launch-out">—</pre>
    </div>
  `;

  document.getElementById('launch-btn').addEventListener('click', async () => {
    const btn = document.getElementById('launch-btn');
    const out = document.getElementById('launch-out');
    btn.disabled = true;
    btn.textContent = 'Running…';
    out.textContent = '—';
    try {
      const res = await apiFetch('/api/launch', { method: 'POST' });
      out.textContent = res.message;
      btn.textContent = '✓ Done';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = '&#9654; Run Launch Sequence';
      }, 2000);
    } catch (err) {
      out.textContent = `Error: ${escHtml(err.message)}`;
      btn.disabled = false;
      btn.textContent = '&#9654; Run Launch Sequence';
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
