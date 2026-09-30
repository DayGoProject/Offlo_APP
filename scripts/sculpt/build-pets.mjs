/**
 * 정원 동물 3D 모델 만들기 — scripts/sculpt/pets.html 을 크로미움에서 실행해 GLB 3개를 `assets/models/pets/`에 쓴다.
 *
 *   node scripts/sculpt/build-pets.mjs [--step 0.045]
 *
 * --step: 조각 격자 간격. 작을수록 매끈하고 삼각형이 늘어난다 (0.03 ≈ 6만 · 0.045 ≈ 2.6만 · 0.06 ≈ 1.5만).
 * 만든 GLB는 `node scripts/inspect-glb.mjs assets/models/pets`로 검사한다. 이 파일 · pets.html 은 직접 만든 코드라 라이선스 문제가 없다.
 */
import { createServer } from "node:http";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const HERE = join(ROOT, "scripts", "sculpt");
const OUT = join(ROOT, "assets", "models", "pets");
const stepArg = process.argv.indexOf("--step");
const step = stepArg >= 0 ? process.argv[stepArg + 1] : "0.045";

const { chromium } = await import(pathToFileURL(join(ROOT, "node_modules", "playwright-core", "index.mjs")).href);

const TYPES = { ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html" };
const server = createServer((req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(readFileSync(join(HERE, "pets.html")));
    }
    if (url.pathname.startsWith("/three/")) {
      const file = join(ROOT, "node_modules", "three", decodeURIComponent(url.pathname.slice("/three/".length)));
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      return res.end(readFileSync(file));
    }
  } catch {
    /* 아래에서 404 */
  }
  res.writeHead(404);
  res.end();
}).listen(8896);

const cache = join(homedir(), "AppData", "Local", "ms-playwright");
const dir = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1])).pop();
const browser = await chromium.launch({ executablePath: join(cache, dir, "chrome-win64", "chrome.exe") });
const page = await browser.newPage();
const logs = [];
page.on("console", (m) => logs.push(m.text()));
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(`http://localhost:8896/?step=${step}`);

try {
  await page.waitForFunction(() => window.__done, null, { timeout: 240_000 });
  const { glbs, stats } = await page.evaluate(() => ({ glbs: window.__glbs, stats: window.__stats }));
  mkdirSync(OUT, { recursive: true });
  for (const [kind, b64] of Object.entries(glbs)) {
    const buf = Buffer.from(b64, "base64");
    writeFileSync(join(OUT, `${kind}.glb`), buf);
    const s = stats[kind];
    console.log(`${kind.padEnd(7)} 삼각형 ${s.tris.toLocaleString()} · 정점 ${s.verts.toLocaleString()} · 뼈대 ${s.bones} · ${(buf.length / 1024).toFixed(0)} KB`);
  }
  console.log(`격자 ${stats.step} · ${stats.ms}ms → ${OUT}`);
} catch (e) {
  console.error("실패:", String(e).split("\n")[0], "\n로그:", logs.slice(0, 8).join(" | "));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
