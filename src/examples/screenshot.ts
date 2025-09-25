import { launchBrowser } from "../browser";
import { ensureDir } from "../utils";

(async function () {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto("https://example.com", { waitUntil: "networkidle2" });
    ensureDir("./outputs");
    await page.screenshot({
      path: "./outputs/example-screenshot.png",
      fullPage: true,
    });
    console.log("Screenshot saved to outputs/example-screenshot.png");
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
