/**
 * 미리보기 화면 여러 장을 한 브라우저로 차례로 찍고, 원하면 한 장의 시트로 합친다 — 3D 아트 확인용 (검증 스크립트가 아니다).
 *
 *   node scripts/preview-batch.mjs "cat=/preview/clay?still=1&type=cat" "dog=/preview/clay?still=1&type=dog" \
 *        --wait 5000 --height 800 --sheet cats-dogs --crop 32,322,716,700 --scale 0.5 --cols 2
 *
 * WebGL 캔버스를 동시에 여러 개 띄우면(별도 프로세스 여럿) GL 컨텍스트가 못 따라가 빈 화면이 찍힌다 — 그래서 한 브라우저로 차례로 연다.
 * 개발 서버(expo start --web, 8081)가 떠 있어야 한다. 결과: `.verify/shot-<이름>.png` (gitignore 대상), 시트는 `.verify/sheet-<이름>.png`.
 * 옵션: --wait <ms> 로드 뒤 대기(기본 4500) · --width/--height 뷰포트 · --sheet <이름> + --crop x,y,w,h(스크린샷 px) --scale s --cols n 로 시트 합치기
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";
import { PNG } from "pngjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, ".verify");
const URL = process.env.OFFLO_WEB_URL ?? "http://localhost:8081";

const args = process.argv.slice(2);
const flag = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : d;
};
const jobs = args.filter((a, i) => a.includes("=") && !a.startsWith("--") && !args[i - 1]?.startsWith("--")).map((a) => {
  const at = a.indexOf("=");
  return [a.slice(0, at), a.slice(at + 1)];
});
if (!jobs.length) {
  console.error('사용법: node scripts/preview-batch.mjs "<이름>=<경로>" … [--wait ms] [--width px] [--height px] [--sheet 이름 --crop x,y,w,h --scale s --cols n]');
  process.exit(1);
}

const cache = join(homedir(), "AppData", "Local", "ms-playwright");
const dir = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))[0];
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: join(cache, dir, "chrome-win64", "chrome.exe") });
const context = await browser.newContext({
  viewport: { width: Number(flag("--width", 390)), height: Number(flag("--height", 800)) },
  deviceScaleFactor: 2,
  colorScheme: "dark",
  timezoneId: "Asia/Seoul",
  locale: "ko-KR",
});
const page = await context.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
for (const [name, path] of jobs) {
  await page.goto(`${URL}${path}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(Number(flag("--wait", 4500)));
  await page.screenshot({ path: join(OUT, `shot-${name}.png`) });
  console.log("ok", name);
}
await browser.close();
if (errors.length) console.log(`콘솔 에러 ${errors.length}건:\n${errors.slice(0, 5).join("\n")}`);

const sheet = flag("--sheet", null);
if (sheet) {
  const [x0, y0, w, h] = String(flag("--crop", "0,0,780,1600")).split(",").map(Number);
  const s = Number(flag("--scale", 0.5));
  const cols = Number(flag("--cols", jobs.length));
  const ow = Math.round(w * s), oh = Math.round(h * s);
  const rows = Math.ceil(jobs.length / cols);
  const res = new PNG({ width: ow * cols, height: oh * rows });
  jobs.forEach(([name], n) => {
    const img = PNG.sync.read(readFileSync(join(OUT, `shot-${name}.png`)));
    const [cx, cy] = [(n % cols) * ow, Math.floor(n / cols) * oh];
    for (let y = 0; y < oh; y++) {
      for (let x = 0; x < ow; x++) {
        const sx = Math.min(img.width - 1, x0 + Math.floor(x / s));
        const sy = Math.min(img.height - 1, y0 + Math.floor(y / s));
        const si = (sy * img.width + sx) * 4;
        const di = ((cy + y) * res.width + cx + x) * 4;
        res.data[di] = img.data[si];
        res.data[di + 1] = img.data[si + 1];
        res.data[di + 2] = img.data[si + 2];
        res.data[di + 3] = 255;
      }
    }
  });
  const file = join(OUT, `sheet-${sheet}.png`);
  writeFileSync(file, PNG.sync.write(res));
  console.log(file, `${res.width}x${res.height}`);
}
