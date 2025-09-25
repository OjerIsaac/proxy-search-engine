# Puppeteer Boilerplate (TypeScript + Stealth)

## Getting started

Install dependencies:

```bash
npm install
```

Build the code:

```bash
npm run build
```

1. Run the default scrape example:

```bash
npm start
```

Run the additional examples:

- Screenshot example: `npm run screenshot`
- Crawl example: `npm run crawl`

### What are these files?

- **src/index.ts** → Main entry point. Opens example.com, saves HTML.
- **src/browser.ts** → Launches Puppeteer with the stealth plugin enabled.
- **src/utils.ts** → Helper utilities for saving files and retry logic.
- **examples/screenshot.ts** → Shows how to take a screenshot of a page.
- **examples/crawl.ts** → Shows how to collect all links on a page and save them.

### Config via env vars

- `HEADLESS=true|false` (default: true)
- `SLOW_MO=number` (ms slowdown)
- `BROWSER_ARGS` (comma-separated extra Chromium flags)
