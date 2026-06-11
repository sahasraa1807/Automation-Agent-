# Automation Agent
## Overview

Automation Agent is a full-stack browser automation tool built on [Playwright](https://playwright.dev/) and [Express](https://expressjs.com/). It streams real-time logs and live screenshots directly into a professional engineering dashboard — no build tools, no bundler, no framework.

Enter a URL. Click **Run Agent**. Watch the browser automate in real time.

---

## Features

| Capability | Description |
|---|---|
| 🌐 **Open Browser** | Launches a headless Chrome instance using your system install |
| 🔗 **Navigate URLs** | Navigates to any `http://` or `https://` address |
| 📜 **Scroll Pages** | Scrolls to trigger lazy-loaded content |
| 🔍 **Detect Forms** | Finds all inputs, textareas, selects, buttons, and links |
| 📸 **Screenshots** | Captures real PNG screenshots at multiple stages |
| 📋 **Execution Logs** | Streams `INFO`, `OK`, `ERROR`, `WARN` logs in real time |
| 📊 **Live Stats** | Tracks duration, actions, errors, and capture count |
| 💾 **Download** | Save any captured screenshot directly from the dashboard |

---

## Stack

```
Frontend  →  HTML + Vanilla CSS + JavaScript (zero dependencies)
Backend   →  Node.js + Express + Playwright Core
Transport →  Server-Sent Events (SSE)
Browser   →  System Chrome / Edge (no binary download required)
```

---

## Project Structure

```
Automation agent/
├── index.html       # Welcome screen + dashboard (single page, two views)
├── style.css        # Dark design system — tokens, layout, components
├── app.js           # Frontend state, SSE client, page transitions
├── server.js        # Express server + Playwright automation engine
├── package.json     # Node.js dependencies
└── README.md        # This file
```

---

## Getting Started

### Prerequisites

- [Node.js v18+](https://nodejs.org/) (v22 recommended)
- Google Chrome **or** Microsoft Edge installed on your system

> **No Playwright browser download needed.** The server auto-detects and uses your existing Chrome or Edge installation.

### 1. Install dependencies

```powershell
cd "Automation agent"
npm install express cors playwright-core --strict-ssl=false
```

> `--strict-ssl=false` is needed if you're behind a corporate proxy or VPN that intercepts SSL.

### 2. Start the server

```powershell
node server.js
```

You should see:

```
  Using browser: C:\Program Files\Google\Chrome\Application\chrome.exe

  Automation Agent server running
  Dashboard →  http://localhost:3000
  API       →  http://localhost:3000/api/run?url=https://example.com
```

### 3. Open the dashboard

Navigate to **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## Usage

1. On the **Welcome Screen**, click **Open Dashboard →**
2. Paste any URL into the input field (e.g. `https://leetcode.com`)
3. Click **Run Agent** or press `Enter`
4. Watch the **Execution Logs** panel stream live output
5. The **Screenshot Preview** panel updates with real browser captures
6. Use the **thumbnail strip** to switch between multiple captures
7. Click **↓ Save** to download any screenshot

---

## How It Works

```
Browser (Dashboard UI)
  │
  │  GET /api/run?url=https://example.com
  │  ← Server-Sent Events stream ─────────────────────────┐
  │                                                        │
  ▼                                                        │
Node.js Server (server.js)                                 │
  │                                                        │
  ├── Launches headless Chrome via Playwright Core         │
  ├── Navigates to the target URL                          │
  ├── Waits for network idle                               │
  ├── Captures screenshot → sends as base64 PNG ──────────►│
  ├── Scrolls the page                                     │
  ├── Captures second screenshot ─────────────────────────►│
  ├── Detects: inputs, textareas, selects, buttons, links  │
  ├── Scrolls back to top                                  │
  ├── Captures final screenshot ──────────────────────────►│
  └── Closes browser, emits "done" event ─────────────────►│
                                                           │
  Dashboard receives events and updates UI in real time ───┘
```

---

## API Reference

### `GET /api/run`

Starts a browser automation session and streams events via SSE.

**Query Parameters**

| Parameter | Required | Description |
|---|---|---|
| `url` | ✅ | The target URL to automate (must include `https://`) |

**Event Types**

| Event | Payload | Description |
|---|---|---|
| `log` | `{ level, message }` | Execution log entry |
| `screenshot` | `{ src, label }` | Base64 PNG data URL + timestamp label |
| `status` | `{ status }` | Agent state change (`running`, `completed`, `failed`) |
| `stats` | `{ actions, errors, screenshots }` | Live counter update |
| `end` | `{}` | Stream complete |

**Example**

```js
const es = new EventSource('/api/run?url=https://example.com');

es.addEventListener('log', (e) => {
  const { level, message } = JSON.parse(e.data);
  console.log(`[${level}] ${message}`);
});

es.addEventListener('screenshot', (e) => {
  const { src } = JSON.parse(e.data);
  document.querySelector('img').src = src;
});

es.addEventListener('end', () => es.close());
```

### `GET /api/health`

Returns server status.

```json
{ "ok": true, "time": "2026-06-11T12:00:00.000Z" }
```

---

## Frontend Integration API

The dashboard exposes a global `window.AgentUI` object for external control:

```js
// Add a log entry
window.AgentUI.addLog('info', 'Navigating to page...');
window.AgentUI.addLog('success', 'Done');
window.AgentUI.addLog('error', 'Something failed');
window.AgentUI.addLog('warn', 'Slow response detected');

// Display a screenshot (accepts any data URL or image path)
window.AgentUI.showScreenshot(dataUrl, '14:32:01');

// Update agent status
window.AgentUI.setStatus('running');    // idle | running | completed | failed

// Increment action counter
window.AgentUI.incrementActions();

// Timer control
window.AgentUI.startTimer();
window.AgentUI.stopTimer();

// Reset all stats
window.AgentUI.resetStats();
```

---

## Extending the Agent

The automation logic lives in [`server.js`](./server.js) inside the `GET /api/run` handler. Add steps after the existing ones:

```js
// Fill a form field
await page.fill('input[name="email"]', 'test@example.com');
log('success', 'Filled email field');

// Click a button
await page.click('button[type="submit"]');
log('info', 'Clicked submit button');

// Wait for navigation
await page.waitForNavigation();
log('success', 'Page navigated after submit');

// Take a screenshot of the result
await captureScreenshot(page, 'post-submit');
```

---

## Configuration

Edit the constants at the top of `server.js` to customize behavior:

| Setting | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `viewport` | `1280×800` | Browser window size |
| `waitUntil` | `domcontentloaded` | Navigation wait strategy |
| `networkidle timeout` | `10000ms` | Max wait for network idle |
| `navigation timeout` | `30000ms` | Max wait for page load |

---

## Troubleshooting

**`UNABLE_TO_VERIFY_LEAF_SIGNATURE`** when running `npm install`
```powershell
npm install <package> --strict-ssl=false
```

**`EAI_AGAIN cdn.playwright.dev`** when running `npx playwright install`
> Your network blocks the Playwright CDN. This project is already configured to use your system Chrome — no browser download is needed.

**`Cannot connect to backend server`** in the dashboard
> Make sure `node server.js` is running before opening the dashboard. Always access it via `http://localhost:3000`, not by opening `index.html` as a file.

**Screenshot shows wrong content / blank**
> Some sites block headless browsers. Try adding a realistic `userAgent` in `server.js` (already included by default).

---

## License

MIT © 2026
