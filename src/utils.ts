import fs from "fs";
import path from "path";

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export async function saveFile(
  filePath: string,
  contents: string | Buffer
): Promise<void> {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, contents);
}

export async function runWithRetries<T>(
  fn: () => Promise<T>,
  retries = 2
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(`Attempt ${i + 1} failed: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}
