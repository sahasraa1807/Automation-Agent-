/**
 * AUTOMATION AGENT — server.js
 * Express + Playwright backend.
 * Streams real-time logs and screenshots to the frontend via SSE.
 *
 * Run:  node server.js
 * UI:   http://localhost:3000
 */

import express from 'express';
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import cors from 'cors';

// ─── BROWSER DETECTION (cross-platform) ─────────────────
// 1. Try Playwright's own downloaded Chromium  → works on Linux / Render / Railway
// 2. Fall back to system Chrome / Edge         → works on Windows locally

let BROWSER_EXEC = null;

// Try playwright-core's built-in executable path (set after `npx playwright install chromium`)
try {
  const pwPath = chromium.executablePath();
  if (pwPath && fs.existsSync(pwPath)) {
    BROWSER_EXEC = pwPath;
    console.log(`  Using Playwright browser: ${BROWSER_EXEC}`);
  }
} catch (_) {}

// Fall back to system installs (Windows)
if (!BROWSER_EXEC) {
  const SYSTEM_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  BROWSER_EXEC = SYSTEM_PATHS.find(p => { try { return fs.existsSync(p); } catch { return false; } }) || null;
  if (BROWSER_EXEC) console.log(`  Using system browser: ${BROWSER_EXEC}`);
}

if (!BROWSER_EXEC) {
  console.error('ERROR: No browser found. Run: npx playwright install chromium');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ─── MIDDLEWARE ──────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve the frontend static files from the same directory
app.use(express.static(__dirname));

// ─── SSE HELPER ─────────────────────────────────────────
function sseSetup(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if proxied
  res.flushHeaders();

  return {
    send(event, data) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    end() {
      res.write(`event: end\ndata: {}\n\n`);
      res.end();
    },
  };
}

// ─── AUTOMATION ENDPOINT ─────────────────────────────────
/**
 * GET /api/run?url=https://example.com
 * Streams Server-Sent Events:
 *   event: log        { level, message }
 *   event: screenshot { src, label }
 *   event: status     { status }
 *   event: stats      { actions, errors, screenshots }
 *   event: end        {}
 */
app.get('/api/run', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    res.status(400).json({ error: 'Missing url query parameter' });
    return;
  }

  const sse = sseSetup(res);
  let browser = null;

  // Track stats
  let actions = 0;
  let errors  = 0;
  let screenshots = 0;

  function log(level, message) {
    console.log(`[${level.toUpperCase()}] ${message}`);
    sse.send('log', { level, message });
  }

  function sendStats() {
    sse.send('stats', { actions, errors, screenshots });
  }

  function action(msg) {
    actions++;
    log('info', msg);
    sendStats();
  }

  async function captureScreenshot(page, label) {
    try {
      const buffer = await page.screenshot({ type: 'png', fullPage: false });
      const dataUrl = 'data:image/png;base64,' + buffer.toString('base64');
      screenshots++;
      sendStats();
      sse.send('screenshot', { src: dataUrl, label });
      log('success', `Screenshot captured — ${label}`);
    } catch (err) {
      log('warn', `Screenshot failed: ${err.message}`);
    }
  }

  // ── Handle client disconnect ────────────────────────
  req.on('close', async () => {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  });

  try {
    sse.send('status', { status: 'running' });
    log('info', `Starting automation for: ${targetUrl}`);

    // ── Launch browser ──────────────────────────────
    log('info', `Launching browser: ${BROWSER_EXEC}`);
    browser = await chromium.launch({
      headless: true,
      ...(BROWSER_EXEC ? { executablePath: BROWSER_EXEC } : {}),
    });
    action('Browser launched');

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    // ── Navigate ────────────────────────────────────
    log('info', `Navigating to ${targetUrl}`);
    try {
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      action(`Navigated to ${targetUrl}`);
    } catch (navErr) {
      errors++;
      log('error', `Navigation error: ${navErr.message}`);
      sendStats();
    }

    // ── Wait for page to settle ─────────────────────
    log('info', 'Waiting for page to settle…');
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      log('success', 'Network idle — page fully loaded');
    } catch (_) {
      log('warn', 'Network idle timeout — proceeding anyway');
    }

    // ── Screenshot #1: initial view ─────────────────
    const ts1 = new Date().toTimeString().slice(0, 8);
    action('Capturing initial screenshot');
    await captureScreenshot(page, `${ts1} — initial`);

    // ── Scroll to detect more content ───────────────
    log('info', 'Scrolling page to reveal lazy-loaded content');
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'smooth' }));
    await page.waitForTimeout(800);
    action('Scrolled page down');

    // ── Screenshot #2: after scroll ─────────────────
    const ts2 = new Date().toTimeString().slice(0, 8);
    action('Capturing post-scroll screenshot');
    await captureScreenshot(page, `${ts2} — scrolled`);

    // ── Detect form elements ────────────────────────
    log('info', 'Detecting interactive form elements');
    const formData = await page.evaluate(() => {
      const inputs   = document.querySelectorAll('input:not([type=hidden])');
      const textareas = document.querySelectorAll('textarea');
      const selects  = document.querySelectorAll('select');
      const buttons  = document.querySelectorAll('button, input[type=submit], input[type=button]');
      const links    = document.querySelectorAll('a[href]');

      return {
        inputs:    inputs.length,
        textareas: textareas.length,
        selects:   selects.length,
        buttons:   buttons.length,
        links:     links.length,
        title:     document.title,
      };
    });
    action('Form element detection complete');

    log('success', `Page title: "${formData.title}"`);
    log('success',
      `Found: ${formData.inputs} input(s), ${formData.textareas} textarea(s), ` +
      `${formData.selects} select(s), ${formData.buttons} button(s), ${formData.links} link(s)`
    );

    // ── Scroll back to top ──────────────────────────
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(500);

    // ── Screenshot #3: final state ──────────────────
    const ts3 = new Date().toTimeString().slice(0, 8);
    action('Capturing final screenshot');
    await captureScreenshot(page, `${ts3} — final`);

    // ── Close browser ───────────────────────────────
    await browser.close();
    browser = null;
    action('Browser closed');

    log('success', 'Automation completed successfully');
    sse.send('status', { status: 'completed' });
    sendStats();

  } catch (err) {
    errors++;
    log('error', `Fatal error: ${err.message}`);
    sendStats();
    sse.send('status', { status: 'failed' });

    if (browser) {
      try { await browser.close(); } catch (_) {}
      browser = null;
    }
  } finally {
    sse.end();
  }
});

// ─── HEALTH CHECK ────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ─── START ───────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Automation Agent server running`);
  console.log(`  Dashboard →  http://localhost:${PORT}`);
  console.log(`  API       →  http://localhost:${PORT}/api/run?url=https://example.com\n`);
});
