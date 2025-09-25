import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Browser } from "puppeteer";

puppeteer.use(StealthPlugin());

export async function launchBrowser(
  options: { slowMo?: number } = {}
): Promise<Browser> {
  const headless = process.env.HEADLESS !== "false";
  const slowMo = process.env.SLOW_MO
    ? Number(process.env.SLOW_MO)
    : options.slowMo || 0;
  const defaultArgs = ["--no-sandbox", "--disable-setuid-sandbox"];
  const extraArgs = process.env.BROWSER_ARGS
    ? process.env.BROWSER_ARGS.split(",")
    : [];

  const browser = await puppeteer.launch({
    headless,
    slowMo,
    args: defaultArgs.concat(extraArgs),
  });

  return browser;
}
