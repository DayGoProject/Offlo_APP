/**
 * 움직이는 미리보기에서 일정 간격으로 프레임을 찍어 한 줄 시트로 붙인다 — 동작(구걸 · 꾹꾹이 · 밥 먹기)을 눈으로 볼 때 쓴다.
 *
 *   node scripts/preview-frames.mjs "/preview/clay?type=dog&stage=adult&condition=peckish" dog-beg --from 2000 --every 350 --n 6 --crop 32,322,716,700
 *   node scripts/preview-frames.mjs "/preview/clay?type=cat&stage=adult" cat-knead --click clay-pet --from 400 --every 150 --n 6 --crop 32,322,716,700
 *
 * --from: 3D가 뜬 뒤(캔버스 준비) 첫 프레임까지 기다릴 ms (--click이 있으면 클릭 뒤부터 잰다) · --every 간격 · --n 장수 · --click <testID> 먼저 누를 버튼
 * 결과: `.verify/sheet-<이름>.png` (gitignore 대상). 개발 서버(8081)가 떠 있어야 한다.
 */
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";
import { PNG } from "pngjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, ".verify");
const [path, name, ...rest] = process.argv.slice(2);
if (!path || !name) {
  console.error('사용법: node scripts/preview-frames.mjs "<경로>" <이름> [--from ms] [--every ms] [--n 장] [--click testID] [--crop x,y,w,h]');
  process.exit(1);
}
const flag = (f, d) => {
  const i = rest.indexOf(f);
  return i >= 0 ? rest[i + 1] : d;
};
const [x0, y0, w, h] = String(flag("--crop", "32,322,716,700")).split(",").map(Number);
const [from, every, n] = [Number(flag("--from", 1500)), Number(flag("--every", 350)), Number(flag("--n", 6))];

const cache = join(homedir(), "AppData", "Local", "ms-playwright");
const dir = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))[0];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: join(cache, dir, "chrome-win64", "chrome.exe") });
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, colorScheme: "dark", timezoneId: "Asia/Seoul", locale: "ko-KR" })).newPage();
await page.goto(`${process.env.OFFLO_WEB_URL ?? "http://localhost:8081"}${path}`, { waitUntil: "networkidle", timeout: 120_000 });
await page.locator("canvas").first().waitFor({ state: "attached", timeout: 60_000 });
await page.waitForTimeout(3500); // 모델을 불러와 첫 프레임이 돌 때까지
const click = flag("--click", null);
if (click) await page.getByTestId(click).click();
const t0 = Date.now();
const frames = [];
for (let i = 0; i < n; i++) {
  const wait = from + i * every - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  frames.push(PNG.sync.read(await page.screenshot()));
}
await browser.close();

const s = 0.5;
const ow = Math.round(w * s), oh = Math.round(h * s);
const res = new PNG({ width: ow * n, height: oh });
frames.forEach((img, k) => {
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const si = (Math.min(img.height - 1, y0 + Math.floor(y / s)) * img.width + Math.min(img.width - 1, x0 + Math.floor(x / s))) * 4;
      const di = (y * res.width + k * ow + x) * 4;
      res.data[di] = img.data[si]; res.data[di + 1] = img.data[si + 1]; res.data[di + 2] = img.data[si + 2]; res.data[di + 3] = 255;
    }
  }
});
const file = join(OUT, `sheet-${name}.png`);
writeFileSync(file, PNG.sync.write(res));
console.log(file, `${res.width}x${res.height}`);
