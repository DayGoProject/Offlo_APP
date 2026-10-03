/**
 * 웹에서 효과음이 실제로 재생 호출되는지 본다 — `HTMLMediaElement.play`와 `fetch(.wav)`를 가로채 기록한다 (소리 자체는 들을 수 없다).
 *   node scripts/sound/probe-web.mjs
 * 개발 서버(8081)가 떠 있어야 한다.
 */
import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { chromium } from "playwright-core";

const cache = join(homedir(), "AppData", "Local", "ms-playwright");
const dir = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))[0];
const browser = await chromium.launch({ executablePath: join(cache, dir, "chrome-win64", "chrome.exe"), args: ["--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, colorScheme: "dark", locale: "ko-KR", timezoneId: "Asia/Seoul" });
await ctx.addInitScript(() => {
  window.__plays = [];
  window.__fetches = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) {
    window.__plays.push({ src: String(this.currentSrc || this.src).slice(0, 80), t: Math.round(performance.now()) });
    return play.apply(this, a);
  };
  const f = window.fetch;
  window.fetch = function (input, ...rest) {
    const u = typeof input === "string" ? input : input?.url;
    if (u && /\.wav|assets/.test(u)) window.__fetches.push(String(u).slice(0, 100));
    return f.call(this, input, ...rest);
  };
});
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 160)));

const plays = () => page.evaluate(() => window.__plays.length);
for (const state of ["fed", "starving", "egg"]) {
  await page.goto(`http://localhost:8081/preview/garden?state=${state}`, { waitUntil: "networkidle" });
  await page.getByTestId("pet-3d-ready").waitFor({ state: "attached", timeout: 30000 });
  await page.waitForTimeout(800);
  const before = await plays();
  await page.getByTestId("pet-touch").click();
  await page.waitForTimeout(900);
  const after = await plays();
  const info = await page.evaluate(() => ({ plays: window.__plays.slice(-2), fetches: window.__fetches.slice(-3) }));
  console.log(`[${state}] 탭 → 재생 호출 ${before} → ${after}`, JSON.stringify(info));
}

// 소리 끄기
await page.goto("http://localhost:8081/preview/garden?state=fed", { waitUntil: "networkidle" });
await page.getByTestId("pet-3d-ready").waitFor({ state: "attached", timeout: 30000 });
await page.waitForTimeout(800);
await page.getByTestId("pet-sound-toggle").click();
const off = await page.getByTestId("pet-sound-toggle").getAttribute("aria-checked");
const b0 = await plays();
await page.getByTestId("pet-touch").click();
await page.waitForTimeout(900);
console.log(`[끄기] aria-checked=${off} · 탭 후 재생 호출 ${b0} → ${await plays()} (같아야 한다)`);
console.log("저장된 선택:", await page.evaluate(() => localStorage.getItem("offlo:pet-sound")));
console.log(errors.length ? `콘솔 에러:\n${errors.join("\n")}` : "콘솔 에러 없음");
await browser.close();
