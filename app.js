/* ─────────────────────────────────────────────────────────
   AUTOMATION AGENT — app.js
   UI state management, page transitions, SSE backend client.
───────────────────────────────────────────────────────── */

'use strict';

// ─── ELEMENT REFERENCES ─────────────────────────────────
const el = {
  urlInput:       document.getElementById('url-input'),
  runBtn:         document.getElementById('run-btn'),
  statusBadge:    document.getElementById('status-badge'),
  logOutput:      document.getElementById('log-output'),
  logEmptyState:  document.getElementById('log-empty-state'),
  logCount:       document.getElementById('log-count'),
  clearLogsBtn:   document.getElementById('clear-logs-btn'),

  screenshotViewport: document.getElementById('screenshot-viewport'),
  screenshotEmpty:    document.getElementById('screenshot-empty'),
  screenshotImg:      document.getElementById('screenshot-img'),
  screenshotTs:       document.getElementById('screenshot-timestamp'),
  downloadBtn:        document.getElementById('download-btn'),
  captureStrip:       document.getElementById('capture-strip'),
  captureStripInner:  document.getElementById('capture-strip-inner'),

  stateIdle:      document.getElementById('state-idle'),
  stateRunning:   document.getElementById('state-running'),
  stateCompleted: document.getElementById('state-completed'),
  stateFailed:    document.getElementById('state-failed'),

  statDuration:     document.getElementById('stat-duration'),
  statActions:      document.getElementById('stat-actions'),
  statErrors:       document.getElementById('stat-errors'),
  statScreenshots:  document.getElementById('stat-screenshots'),

  footerTime:   document.getElementById('footer-time'),
  welcomeClock: document.getElementById('welcome-clock'),
};

// ─── APPLICATION STATE ───────────────────────────────────
const state = {
  status:       'idle',   // idle | running | completed | failed
  logEntries:   [],
  screenshots:  [],
  logCount:     0,
  actionCount:  0,
  errorCount:   0,
  startTime:    null,
  durationTimer: null,
};

// ─── SCREEN TRANSITIONS ──────────────────────────────────

const welcomeScreen   = document.getElementById('welcome-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const launchBtn       = document.getElementById('launch-btn');
const backBtn         = document.getElementById('back-btn');

function showDashboard() {
  welcomeScreen.classList.add('screen--exiting');
  setTimeout(() => {
    welcomeScreen.classList.remove('screen--active', 'screen--exiting');
    welcomeScreen.style.display = 'none';
    dashboardScreen.style.display = 'flex';
    dashboardScreen.classList.add('screen--active', 'screen--entering');
    setTimeout(() => dashboardScreen.classList.remove('screen--entering'), 500);
    el.urlInput.focus();
  }, 220);
}

function showWelcome() {
  dashboardScreen.classList.add('screen--exiting');
  setTimeout(() => {
    dashboardScreen.classList.remove('screen--active', 'screen--exiting');
    dashboardScreen.style.display = 'none';
    welcomeScreen.style.display = 'flex';
    welcomeScreen.classList.add('screen--active', 'screen--entering');
    setTimeout(() => welcomeScreen.classList.remove('screen--entering'), 500);
  }, 220);
}

launchBtn.addEventListener('click', showDashboard);
backBtn.addEventListener('click', showWelcome);

// ─── ANIMATED BACKGROUND LOG STREAM ─────────────────────

const BG_LOGS = [
  '→ Browser launched (Chromium headless)',
  '✓ Navigated to https://leetcode.com',
  '✓ Page loaded — network idle',
  '→ Scrolling page to detect elements',
  '✓ Screenshot captured [1280×800]',
  '→ Found 4 inputs, 2 buttons',
  '✓ Form fields filled',
  '→ Clicking submit at (320, 480)',
  '✓ Response in 240ms',
  '→ Capturing final screenshot',
  '✓ Automation completed',
  '→ Browser closed',
  '✓ Run finished in 8.4s',
  '→ Navigating to https://github.com',
  '✓ DOM content loaded',
  '→ Detecting interactive elements',
  '✓ Scroll depth: 2400px',
  '→ Click at (640, 200)',
  '✓ Screenshot [001] saved',
  '✓ Screenshot [002] saved',
];

(function buildBgLogStream() {
  const container = document.getElementById('bg-log-stream');
  if (!container) return;
  BG_LOGS.forEach((text, i) => {
    const div = document.createElement('div');
    div.className = 'bg-log-line';
    div.textContent = text;
    const duration = 14 + Math.random() * 12;
    const delay    = i * 1.2 + Math.random() * 2;
    div.style.cssText = [
      `animation-duration:${duration}s`,
      `animation-delay:${delay}s`,
      `opacity:0`,
      `color:${text.startsWith('✓') ? '#22c55e' : '#3d5a80'}`,
    ].join(';');
    container.appendChild(div);
  });
})();

// ─── STATUS MANAGEMENT ──────────────────────────────────

const STATUS_CONFIG = {
  idle:      { label: 'Idle',      badgeClass: 'badge--idle',      stateEl: 'stateIdle' },
  running:   { label: 'Running',   badgeClass: 'badge--running',   stateEl: 'stateRunning' },
  completed: { label: 'Completed', badgeClass: 'badge--completed', stateEl: 'stateCompleted' },
  failed:    { label: 'Failed',    badgeClass: 'badge--failed',    stateEl: 'stateFailed' },
};

function setStatus(status) {
  state.status = status;
  const cfg = STATUS_CONFIG[status];

  // Update badge
  el.statusBadge.className = `badge ${cfg.badgeClass}`;
  el.statusBadge.querySelector('.badge__label').textContent = cfg.label;
  el.statusBadge.setAttribute('aria-label', `Agent status: ${cfg.label}`);

  // Update status grid
  const stateIds = ['stateIdle', 'stateRunning', 'stateCompleted', 'stateFailed'];
  stateIds.forEach(id => el[id].classList.remove('status-item--active'));
  el[cfg.stateEl].classList.add('status-item--active');

  // Run button state
  const isRunning = status === 'running';
  el.runBtn.disabled = isRunning;
  el.runBtn.querySelector('.btn__label').textContent = isRunning ? 'Running…' : 'Run Agent';
  el.runBtn.classList.toggle('btn--running', isRunning);
}

// ─── LOG MANAGEMENT ─────────────────────────────────────

/**
 * Add a log entry to the panel.
 * @param {'info'|'success'|'error'|'warn'} level
 * @param {string} message
 */
function addLog(level, message) {
  const now = new Date();
  const time = now.toTimeString().slice(0, 8);

  const entry = { time, level, message, id: ++state.logCount };
  state.logEntries.push(entry);

  // Remove empty state
  if (el.logEmptyState) {
    el.logEmptyState.style.display = 'none';
  }

  // Track error count
  if (level === 'error') {
    state.errorCount++;
    el.statErrors.textContent = state.errorCount;
    el.statErrors.style.color = 'var(--c-error)';
  }

  // Build DOM element
  const div = document.createElement('div');
  div.className = `log-entry log-entry--${level} log-entry--new`;
  div.setAttribute('role', 'listitem');
  div.innerHTML = `
    <span class="log-entry__time">${escapeHtml(time)}</span>
    <span class="log-entry__level">${escapeHtml(levelLabel(level))}</span>
    <span class="log-entry__msg">${escapeHtml(message)}</span>
  `;

  el.logOutput.appendChild(div);

  // Auto-scroll
  requestAnimationFrame(() => {
    el.logOutput.parentElement.scrollTop = el.logOutput.parentElement.scrollHeight;
  });

  // Update count chip
  el.logCount.textContent = `${state.logCount} ${state.logCount === 1 ? 'entry' : 'entries'}`;

  // Remove animation class after it plays
  setTimeout(() => div.classList.remove('log-entry--new'), 250);
}

function levelLabel(level) {
  return { info: 'INFO', success: 'OK', error: 'ERROR', warn: 'WARN' }[level] || level.toUpperCase();
}

function clearLogs() {
  state.logEntries = [];
  state.logCount = 0;
  el.logOutput.innerHTML = '';
  el.logCount.textContent = '0 entries';

  // Restore empty state
  const emptyDiv = document.createElement('div');
  emptyDiv.className = 'log-empty';
  emptyDiv.id = 'log-empty-state';
  emptyDiv.innerHTML = `
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="4" y="4" width="20" height="20" rx="3" stroke="currentColor" stroke-width="1.5"/>
      <line x1="8" y1="10" x2="20" y2="10" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
      <line x1="8" y1="14" x2="17" y2="14" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
      <line x1="8" y1="18" x2="13" y2="18" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
    </svg>
    <p>No logs yet. Run the agent to start capturing output.</p>
  `;
  el.logOutput.appendChild(emptyDiv);
}

// ─── SCREENSHOT MANAGEMENT ───────────────────────────────

/**
 * Display a screenshot in the preview panel.
 * @param {string} src — data URL or image path from backend
 * @param {string} [label] — optional timestamp / label
 */
function showScreenshot(src, label) {
  state.screenshots.push({ src, label, id: state.screenshots.length + 1 });

  el.screenshotEmpty.style.display = 'none';
  el.screenshotImg.src = src;
  el.screenshotImg.style.display = 'block';

  // Timestamp chip
  if (label) {
    el.screenshotTs.textContent = label;
    el.screenshotTs.style.display = 'inline-flex';
  }

  // Download button
  el.downloadBtn.style.display = 'inline-flex';
  el.downloadBtn.onclick = () => downloadScreenshot(src, label);

  // Add to capture strip
  addThumb(src, state.screenshots.length - 1);

  // Update stat
  el.statScreenshots.textContent = state.screenshots.length;
}

function addThumb(src, index) {
  el.captureStrip.style.display = 'block';

  // Deactivate previous thumbs
  el.captureStripInner.querySelectorAll('.thumb').forEach(t => t.classList.remove('thumb--active'));

  const thumb = document.createElement('button');
  thumb.className = 'thumb thumb--active';
  thumb.setAttribute('aria-label', `Screenshot ${index + 1}`);
  thumb.innerHTML = `<img src="${src}" alt="Screenshot ${index + 1}" />`;
  thumb.addEventListener('click', () => {
    el.screenshotImg.src = src;
    el.captureStripInner.querySelectorAll('.thumb').forEach(t => t.classList.remove('thumb--active'));
    thumb.classList.add('thumb--active');
  });

  el.captureStripInner.appendChild(thumb);

  // Scroll strip to end
  requestAnimationFrame(() => {
    el.captureStripInner.scrollLeft = el.captureStripInner.scrollWidth;
  });
}

function downloadScreenshot(src, label) {
  const a = document.createElement('a');
  a.href = src;
  a.download = `screenshot-${label || Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─── LOADING OVERLAY ─────────────────────────────────────

function showScreenshotLoading(show) {
  let overlay = el.screenshotViewport.querySelector('.screenshot-loading');
  if (show && !overlay) {
    overlay = document.createElement('div');
    overlay.className = 'screenshot-loading';
    overlay.innerHTML = `<div class="screenshot-loading__spinner" aria-label="Loading screenshot"></div>`;
    el.screenshotViewport.appendChild(overlay);
  } else if (!show && overlay) {
    overlay.remove();
  }
}

// ─── TIMER ───────────────────────────────────────────────

function startTimer() {
  state.startTime = Date.now();
  state.durationTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    el.statDuration.textContent = formatDuration(elapsed);
  }, 1000);
}

function stopTimer() {
  if (state.durationTimer) {
    clearInterval(state.durationTimer);
    state.durationTimer = null;
  }
}

function formatDuration(secs) {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

// ─── STATS RESET ─────────────────────────────────────────

function resetStats() {
  state.actionCount  = 0;
  state.errorCount   = 0;
  el.statActions.textContent    = '0';
  el.statErrors.textContent     = '0';
  el.statErrors.style.color     = '';
  el.statScreenshots.textContent = '0';
  el.statDuration.textContent   = '—';
}

function incrementActions() {
  state.actionCount++;
  el.statActions.textContent = state.actionCount;
}

// ─── BACKEND INTEGRATION ─────────────────────────────────
// Connects to the Playwright backend via Server-Sent Events (SSE).
// The backend streams log events, real screenshots, and status updates.
// Run `node server.js` first, then open http://localhost:3000

const SERVER_URL = window.location.origin; // Same origin when served by Node

/** Active EventSource — kept so we can close it on abort */
let activeEventSource = null;

/**
 * Called when the user clicks "Run Agent".
 * Streams real browser logs and screenshots from the Playwright backend.
 */
function runAgent(url) {
  return new Promise((resolve, reject) => {
    // Reset UI
    setStatus('running');
    resetStats();
    clearLogs();
    startTimer();
    showScreenshotLoading(true);

    // Close any previous connection
    if (activeEventSource) {
      activeEventSource.close();
      activeEventSource = null;
    }

    const endpoint = `${SERVER_URL}/api/run?url=${encodeURIComponent(url)}`;
    const es = new EventSource(endpoint);
    activeEventSource = es;

    // ── Log events ──────────────────────────────────
    es.addEventListener('log', (e) => {
      const { level, message } = JSON.parse(e.data);
      addLog(level, message);
    });

    // ── Screenshot events ────────────────────────────
    es.addEventListener('screenshot', (e) => {
      showScreenshotLoading(false);
      const { src, label } = JSON.parse(e.data);
      showScreenshot(src, label);
    });

    // ── Status events ────────────────────────────────
    es.addEventListener('status', (e) => {
      const { status } = JSON.parse(e.data);
      setStatus(status);
      if (status === 'completed' || status === 'failed') {
        stopTimer();
      }
    });

    // ── Stats sync from backend ──────────────────────
    es.addEventListener('stats', (e) => {
      const { actions, errors } = JSON.parse(e.data);
      state.actionCount = actions;
      state.errorCount  = errors;
      el.statActions.textContent = actions;
      el.statErrors.textContent  = errors;
      if (errors > 0) el.statErrors.style.color = 'var(--c-error)';
    });

    // ── Stream complete ──────────────────────────────
    es.addEventListener('end', () => {
      showScreenshotLoading(false);
      es.close();
      activeEventSource = null;
      resolve();
    });

    // ── Connection error ─────────────────────────────
    es.onerror = (err) => {
      showScreenshotLoading(false);
      es.close();
      activeEventSource = null;

      // Check if server is unreachable
      const isConnErr = !err.target || err.target.readyState === EventSource.CLOSED;
      if (isConnErr) {
        stopTimer();
        setStatus('failed');
        addLog('error', 'Cannot connect to backend server.');
        addLog('error', 'Make sure the server is running:  node server.js');
        addLog('info',  'Then open  http://localhost:3000  in your browser.');
        reject(new Error('Server unreachable'));
      }
    };
  });
}

// ─── EVENT HANDLERS ──────────────────────────────────────

el.runBtn.addEventListener('click', async () => {
  const url = el.urlInput.value.trim();

  if (!url) {
    el.urlInput.focus();
    shakeElement(el.urlInput.closest('.url-bar'));
    return;
  }

  if (!isValidUrl(url)) {
    addLog('error', `Invalid URL: "${url}". Please include https://`);
    shakeElement(el.urlInput.closest('.url-bar'));
    return;
  }

  try {
    await runAgent(url);
  } catch (err) {
    stopTimer();
    setStatus('failed');
    addLog('error', `Agent encountered a fatal error: ${err.message}`);
  }
});

el.urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && state.status !== 'running') {
    el.runBtn.click();
  }
});

el.clearLogsBtn.addEventListener('click', clearLogs);

// ─── FOOTER CLOCK ────────────────────────────────────────

function updateClock() {
  const now = new Date();
  const t = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  if (el.footerTime)   el.footerTime.textContent   = t;
  if (el.welcomeClock) el.welcomeClock.textContent  = t;
}
updateClock();
setInterval(updateClock, 1000);

// ─── UTILITIES ───────────────────────────────────────────

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shakeElement(el) {
  el.style.transition = 'transform 0.06s ease';
  const seq = ['-4px','4px','-3px','3px','0px'];
  let i = 0;
  const tick = () => {
    el.style.transform = `translateX(${seq[i++]})`;
    if (i < seq.length) setTimeout(tick, 60);
    else el.style.transform = '';
  };
  tick();
}

// ─── PUBLIC API ──────────────────────────────────────────
/*
  Expose these functions for integration with your backend.

  window.AgentUI.addLog('info', 'Navigating...');
  window.AgentUI.addLog('success', 'Done');
  window.AgentUI.addLog('error', 'Something failed');
  window.AgentUI.showScreenshot(dataUrl, '14:32:01');
  window.AgentUI.setStatus('running');
  window.AgentUI.incrementActions();
*/
window.AgentUI = {
  addLog,
  showScreenshot,
  setStatus,
  incrementActions,
  startTimer,
  stopTimer,
  resetStats,
};
