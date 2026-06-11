# Automation Agent

A browser automation control panel built with Playwright and Node.js. Enter a URL, run the agent, and watch real-time logs and live screenshots stream into the dashboard.

---

## Stack

- **Frontend** — HTML, CSS, JavaScript (no framework)
- **Backend** — Node.js + Express
- **Automation** — Playwright Core (uses your installed Chrome)
- **Transport** — Server-Sent Events (SSE)

---

## Setup

> Requires Node.js v18+ and Google Chrome installed.

```bash
# Install dependencies
npm install express cors playwright-core --strict-ssl=false

# Start the server
node server.js
```



---

## Usage

1. Click **Open Dashboard** on the welcome screen
2. Enter a URL (e.g. `https://leetcode.com`)
3. Click **Run Agent**
4. Watch logs stream and screenshots appear in real time

---

## Project Files

```
index.html      # Welcome screen + dashboard UI
style.css       # Dark theme design system
app.js          # Frontend logic + SSE client
server.js       # Playwright automation backend
package.json    # Dependencies
```

---

## Troubleshooting

| Error | Fix |
|---|---|
| `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | Use `npm install --strict-ssl=false` |
| `EAI_AGAIN cdn.playwright.dev` | Already handled — uses your system Chrome |
| Dashboard not loading | Make sure `node server.js` is running first |
