/**
 * server.js
 * Transparent Puppeteer renderer + asset proxy (with stealth + error handling)
 */

require("dotenv").config();

const express = require("express");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cheerio = require("cheerio");

puppeteer.use(StealthPlugin());

const APP_PORT = process.env.PORT || 3000;
const TARGET = process.env.TARGET || "https://www.google.com";
const TARGET_HOST = new URL(TARGET).host;
const MAX_RENDER_CONCURRENCY =
  parseInt(process.env.MAX_RENDER_CONCURRENCY, 10) || 3;
const RENDER_TIMEOUT = parseInt(process.env.RENDER_TIMEOUT_MS, 10) || 45000;

console.log("Loaded ENV:", {
  APP_PORT,
  TARGET,
  MAX_RENDER_CONCURRENCY,
  RENDER_TIMEOUT,
});

const app = express();

// --- concurrency limiter ---
function createLimiter(concurrency) {
  let active = 0;
  const queue = [];

  function next() {
    if (queue.length === 0 || active >= concurrency) return;
    const task = queue.shift();
    task();
  }

  return function limit(fn) {
    return new Promise((resolve, reject) => {
      const run = async () => {
        active++;
        try {
          const r = await fn();
          resolve(r);
        } catch (err) {
          reject(err);
        } finally {
          active--;
          setImmediate(next);
        }
      };

      if (active < concurrency) {
        run();
      } else {
        queue.push(run);
      }
    });
  };
}

const limit = createLimiter(MAX_RENDER_CONCURRENCY);

// --- helpers ---
function toProxyPath(href) {
  try {
    const resolved = new URL(href, TARGET).toString();
    const parsed = new URL(resolved);
    return "/proxy" + parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return href;
  }
}

function toRenderPath(href) {
  try {
    const resolved = new URL(href, TARGET).toString();
    return "/render?url=" + encodeURIComponent(resolved);
  } catch {
    return href;
  }
}

// --- puppeteer management ---
let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return browserPromise;
}

async function renderPageWithPuppeteer(targetUrl) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  // ignore favicon / async aborts
  page.on("requestfailed", (req) => {
    const err = req.failure()?.errorText || "";
    if (err.includes("net::ERR_ABORTED")) {
      console.warn("Ignored abort:", req.url());
    } else {
      console.warn("Request failed:", req.url(), err);
    }
  });

  await page.setUserAgent(
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/122 Safari/537.36"
  );

  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded", // lighter than networkidle2 for Google
    timeout: RENDER_TIMEOUT,
  });

  const html = await page.content();
  await page.close();
  return html;
}

function rewriteHtml(html) {
  const $ = cheerio.load(html);

  // rewrite links
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (href) $(el).attr("href", toRenderPath(href));
  });

  // rewrite forms
  $("form").each((_, el) => {
    const action = $(el).attr("action") || "/";
    try {
      const resolved = new URL(action, TARGET).toString();
      const parsed = new URL(resolved);
      $(el).attr("action", parsed.pathname);
      $(el).attr("method", "GET");
    } catch {}
  });

  // rewrite assets
  ["img", "script", "link"].forEach((tag) => {
    $(tag).each((_, el) => {
      const attr = tag === "link" ? "href" : "src";
      const val = $(el).attr(attr);
      if (val) $(el).attr(attr, toProxyPath(val));
    });
  });

  return $.html();
}

// --- routes ---
app.get("/", async (req, res) => {
  try {
    const html = await limit(() => renderPageWithPuppeteer(TARGET));
    res.send(rewriteHtml(html));
  } catch (err) {
    console.error("Render error:", err.message);
    res.status(500).send("Rendering error");
  }
});

app.get("/render", async (req, res) => {
  let targetUrl = req.query.url;

  if (!targetUrl) {
    const query = { ...req.query };
    delete query.url;

    const base = TARGET.replace(/\/$/, "") + req.path;
    const searchParams = new URLSearchParams(query).toString();
    targetUrl = base + (searchParams ? "?" + searchParams : "");
  }

  if (!targetUrl) return res.status(400).send("Missing url param");

  try {
    const html = await limit(() => renderPageWithPuppeteer(targetUrl));
    res.send(rewriteHtml(html));
  } catch (err) {
    console.error("Render error:", err.message);
    res.status(500).send("Rendering error");
  }
});

// proxy for static assets
app.use(
  "/proxy",
  createProxyMiddleware({
    target: TARGET,
    changeOrigin: true,
    pathRewrite: { "^/proxy": "" },
    selfHandleResponse: false,
    onProxyRes(proxyRes) {
      const loc =
        proxyRes.headers &&
        (proxyRes.headers.location || proxyRes.headers.Location);
      if (loc) {
        try {
          const resolved = new URL(loc, TARGET).toString();
          proxyRes.headers.location =
            "/render?url=" + encodeURIComponent(resolved);
        } catch {}
      }
    },
  })
);

// catch-all: render any path
app.get("*", async (req, res) => {
  const targetUrl = TARGET.replace(/\/$/, "") + req.originalUrl;

  try {
    const html = await limit(() => renderPageWithPuppeteer(targetUrl));
    res.send(rewriteHtml(html));
  } catch (err) {
    console.error("Render error:", err.message);
    res.status(500).send("Rendering error");
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(APP_PORT, () => {
  console.log(`Renderer listening at http://localhost:${APP_PORT}`);
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  if (browserPromise) {
    try {
      const b = await browserPromise;
      await b.close();
    } catch {}
  }
  process.exit(0);
});
