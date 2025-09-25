import { launchBrowser } from "./browser";
import { saveFile, runWithRetries } from "./utils";

async function scrapeExample(): Promise<void> {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await page.goto("https://example.com", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const title = await page.title();
    const html = await page.content();

    console.log("Page title:", title);

    await saveFile("./outputs/example.html", html);
    console.log("Saved HTML to outputs/example.html");
  } catch (err) {
    console.error("Scrape failed:", err);
  } finally {
    await browser.close();
  }
}

runWithRetries(scrapeExample, 2).catch((err) => {
  console.error("All attempts failed:", err);
  process.exit(1);
});
