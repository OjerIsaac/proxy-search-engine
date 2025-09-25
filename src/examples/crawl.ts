import { launchBrowser } from "../browser";
import { saveFile } from "../utils";

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
    const links = await page.$$eval("a", (anchors) =>
      anchors
        .map((a) => ({
          href: (a as HTMLAnchorElement).href,
          text: a.textContent?.trim() || "",
        }))
        .slice(0, 30)
    );
    console.log("Found links:", links.length);
    await saveFile("./outputs/links.json", JSON.stringify(links, null, 2));
    console.log("Saved links to outputs/links.json");
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
