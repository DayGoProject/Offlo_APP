/**
 * M9 검증 — 웹 **사용자별 AI 호출 횟수 제한**(`lib/ai-usage.ts`)을 `/api/ai/analyze` · `weekly` · `chat`의 **실제 라우트 코드 그대로** 메모리 Firestore에 연결해 돌린다 (Node · 네트워크 불필요).
 *
 *   node scripts/verify-M9-ai-limit.mjs      (웹 레포가 ../Offlo 에 있어야 한다 — OFFLO_WEB_ROOT로 바꿀 수 있다)
 *
 * 배경: 일간 · 주간 분석 1회 제한은 "저장된 분석"으로 판단해서, AI를 부르고 **저장하지 않으면** 걸리지 않았다 (토큰 하나로 Gemini를 끝없이 호출 = 비용).
 * 채팅에는 횟수 제한이 아예 없었다. 테스터에게 앱을 배포하기 전에(M9) 막는다.
 * `@/lib/firebase-admin`(토큰 검증 · Firestore 트랜잭션 — **실제 Firestore처럼 읽은 값이 바뀌면 다시 시도한다**) · `@/lib/prisma`(메모리 표) · `@/lib/ai`(Gemini를 부르지 않고 세기만 한다)를 바꿔 끼운다.
 * **진짜 Firestore · 배포된 서버에서의 동작은 확인하지 못한다** — 웹을 배포한 뒤 한 번 확인한다 (Admin SDK 트랜잭션 · 서버 전용 경로).
 *
 * 확인 항목
 *   1. 상한까지는 통과하고 그 다음은 429 + 한국어 안내 — 일간 분석 6 · 주간 3 · 채팅 120 (Gemini는 상한 안에서만 불린다)
 *   2. 입력이 틀렸거나(400) 이미 분석했으면(409) 횟수를 쓰지 않는다 — 실수로 상한을 깎지 않는다
 *   3. 종류별로 따로 센다 · 사용자별로 따로 센다 (남이 내 횟수를 쓰지 않는다)
 *   4. 동시에 와도 상한을 넘기지 못한다 (트랜잭션) — 30개가 한꺼번에 와도 정확히 상한만큼만 통과
 *   5. 하루가 지나면(KST 자정) 새로 센다 · 날짜 경계는 UTC가 아니라 KST
 *   6. 저장 경로 — 서버 전용 `users/{uid}/aiUsage/{KST 날짜}` · 깨진 값은 0으로 본다 · Gemini가 실패해도 횟수는 센다
 */
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_ROOT = process.env.OFFLO_WEB_ROOT ?? resolve(ROOT, "..", "Offlo");
const WEB_SRC = join(WEB_ROOT, "web", "src");
if (!existsSync(WEB_SRC)) {
  console.error(`✗ 웹 레포를 찾을 수 없습니다: ${WEB_ROOT} (OFFLO_WEB_ROOT로 지정하세요)`);
  process.exit(1);
}

/* ── 가짜 모듈 ───────────────────────────────────────────────── */
const REAL_ADMIN = pathToFileURL(join(WEB_SRC, "lib", "firebase-admin.ts")).href;
const FAKES = {
  "@/lib/firebase-admin": `
    export { apiError, handleApiError } from ${JSON.stringify(REAL_ADMIN)};
    import { apiError } from ${JSON.stringify(REAL_ADMIN)};
    const tick = () => new Promise((r) => setImmediate(r)); // 요청이 서로 끼어들 틈 (실제 서버 왕복)
    const store = () => globalThis.__FS; // path -> { data, version }
    const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
    export async function verifyIdToken(req) {
      const h = req.headers.get("Authorization");
      if (!h?.startsWith("Bearer ")) throw apiError("인증이 필요합니다.", 401);
      return h.slice(7); // 가짜: 토큰 = uid
    }
    export function getAdminFirestore() {
      return {
        doc: (path) => ({ path }),
        // 실제 Firestore 트랜잭션처럼 — 읽은 문서가 그 사이 바뀌었으면 처음부터 다시 돈다
        runTransaction: async (fn) => {
          for (let attempt = 0; attempt < 25; attempt++) {
            const reads = new Map();
            const writes = [];
            const tx = {
              get: async (ref) => {
                await tick();
                const cur = store().get(ref.path);
                reads.set(ref.path, cur?.version ?? 0);
                return { data: () => clone(cur?.data) };
              },
              set: (ref, data, opts) => writes.push({ path: ref.path, data: clone(data), merge: Boolean(opts?.merge) }),
            };
            const result = await fn(tx);
            await tick();
            const stale = [...reads].some(([path, version]) => (store().get(path)?.version ?? 0) !== version);
            if (stale) { globalThis.__RETRIES++; continue; }
            for (const w of writes) {
              const cur = store().get(w.path);
              store().set(w.path, { data: w.merge ? { ...(cur?.data ?? {}), ...w.data } : w.data, version: (cur?.version ?? 0) + 1 });
            }
            return result;
          }
          throw new Error("트랜잭션 재시도 초과");
        },
      };
    }`,
  "@/lib/prisma": `
    const tick = () => new Promise((r) => setImmediate(r));
    export const prisma = {
      user: { findUnique: async ({ where }) => (await tick(), globalThis.__USERS.get(where.uid) ?? null) },
      analysis: { findFirst: async () => (await tick(), globalThis.__EXISTING_ANALYSIS ? { id: "a1" } : null) },
    };`,
  "@/lib/ai": `
    export const DAILY_ANALYSIS_PROMPT = "daily";
    export const buildWeeklyPrompt = () => "weekly";
    export const buildChatSystemPrompt = () => "system";
    export function assertInlineImage() {}
    export function parseGeminiJson(text) { return JSON.parse(text); }
    // Gemini를 부르지 않고 몇 번 불렸는지만 센다
    export function getGeminiModel() {
      const call = async () => {
        globalThis.__GEMINI++;
        if (globalThis.__GEMINI_FAIL) throw new Error("Gemini 장애");
        return { response: { text: () => '{"ok":true}' } };
      };
      return { generateContent: call, startChat: () => ({ sendMessage: call }) };
    }`,
};
const FAKE_URL = (name) => `offlo-fake:${name}`;

registerHooks({
  resolve(specifier, context, next) {
    if (FAKES[specifier]) return { url: FAKE_URL(specifier), shortCircuit: true };
    if (specifier.startsWith("@/")) {
      const base = join(WEB_SRC, specifier.slice(2));
      const file = [".ts", ".tsx", "/index.ts"].map((ext) => base + ext).find(existsSync);
      if (file) return next(pathToFileURL(file).href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    for (const [name, source] of Object.entries(FAKES)) {
      if (url === FAKE_URL(name)) return { format: "module", source, shortCircuit: true };
    }
    return next(url, context);
  },
});

const route = (name) => import(pathToFileURL(join(WEB_SRC, "app", "api", "ai", name, "route.ts")).href);
const analyze = await route("analyze");
const weekly = await route("weekly");
const chat = await route("chat");
const usage = await import(pathToFileURL(join(WEB_SRC, "lib", "ai-usage.ts")).href);

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};

/* ── 도구 ────────────────────────────────────────────────────── */
const reset = () => {
  globalThis.__FS = new Map();
  globalThis.__USERS = new Map([
    ["u1", { id: "id-1" }],
    ["u2", { id: "id-2" }],
  ]);
  globalThis.__GEMINI = 0;
  globalThis.__GEMINI_FAIL = false;
  globalThis.__EXISTING_ANALYSIS = false;
  globalThis.__RETRIES = 0;
};
const post = async (handler, body, { uid = "u1", auth = true } = {}) => {
  const res = await handler.POST(
    new Request("http://localhost/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${uid}` } : {}) },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, json: await res.json() };
};
const DAILY = { imageBase64: "AAAA", mimeType: "image/jpeg" };
const WEEK = { dailySummaries: Array.from({ length: 7 }, (_, i) => ({ totalMinutes: 200 + i, detoxScore: 70, date: `2026-10-0${i + 1}`, apps: [] })) };
const CHAT = {
  analysisId: "an1",
  messages: [{ role: "user", text: "안녕" }],
  analysisContext: { periodType: "daily", totalMinutes: 200, detoxScore: 70, apps: [], coreProblems: [] },
};
const doAnalyze = (opts) => post(analyze, DAILY, opts);
const doWeekly = (opts) => post(weekly, WEEK, opts);
const doChat = (opts) => post(chat, CHAT, opts);
const stored = (uid, dateKey) => globalThis.__FS.get(`users/${uid}/aiUsage/${dateKey}`)?.data;
const todayKey = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

/* ── 1. 상한까지는 통과 · 그 다음은 429 ───────────────────────── */
{
  check(usage.AI_DAILY_LIMITS.analyze === 6 && usage.AI_DAILY_LIMITS.weekly === 3 && usage.AI_DAILY_LIMITS.chat === 120, "상한 — 일간 분석 6 · 주간 3 · 채팅 120 (정상 사용은 일간 1 · 주간 1 · 채팅 수십)");
  for (const [name, doIt, limit] of [
    ["일간 분석", doAnalyze, 6],
    ["주간 분석", doWeekly, 3],
    ["채팅", doChat, 120],
  ]) {
    reset();
    const results = [];
    for (let i = 0; i < limit; i++) results.push((await doIt()).status);
    check(results.every((s) => s === 200) && globalThis.__GEMINI === limit, `${name} — 상한(${limit}번)까지는 모두 통과하고 Gemini를 그만큼 부른다`, `${results.filter((s) => s === 200).length}번 통과 · Gemini ${globalThis.__GEMINI}번`);
    const over = await doIt();
    check(over.status === 429 && typeof over.json.error === "string" && /[가-힣]/.test(over.json.error) && globalThis.__GEMINI === limit, `${name} — ${limit + 1}번째는 429 + 한국어 안내, Gemini는 더 부르지 않는다`, over.json.error);
    check((await doIt()).status === 429 && globalThis.__GEMINI === limit, `${name} — 그 뒤로도 계속 막힌다`);
  }
  reset();
  check((await post(analyze, DAILY, { auth: false })).status === 401 && (await post(chat, CHAT, { auth: false })).status === 401, "토큰이 없으면 401 (횟수를 세기 전에 막는다)");
  check(Object.keys(Object.fromEntries(globalThis.__FS)).length === 0, "401은 아무것도 저장하지 않는다");
}

/* ── 2. 틀린 입력 · 이미 분석함은 횟수를 쓰지 않는다 ──────────── */
{
  reset();
  const bad = await post(weekly, { dailySummaries: [] });
  check(bad.status === 400 && stored("u1", todayKey()) === undefined, "주간 입력이 틀리면(400) 횟수를 쓰지 않는다", JSON.stringify(bad.json).slice(0, 60));
  const badChat = await post(chat, { ...CHAT, messages: "nope" });
  check(badChat.status === 400 && stored("u1", todayKey()) === undefined, "채팅 입력이 틀리면(400) 횟수를 쓰지 않는다");
  const badLast = await post(chat, { ...CHAT, messages: [{ role: "model", text: "먼저 말함" }] });
  check(badLast.status === 400 && stored("u1", todayKey()) === undefined, "마지막 메시지가 사용자가 아니면(400) 횟수를 쓰지 않는다");
  globalThis.__EXISTING_ANALYSIS = true;
  const done = await doAnalyze();
  check(done.status === 409 && stored("u1", todayKey()) === undefined && globalThis.__GEMINI === 0, "오늘 이미 분석했으면(409) 횟수를 쓰지 않고 Gemini도 안 부른다");
  const doneWeek = await doWeekly();
  check(doneWeek.status === 409 && stored("u1", todayKey()) === undefined, "이번 주 이미 받았으면(409) 횟수를 쓰지 않는다");
  globalThis.__EXISTING_ANALYSIS = false;
  const unknownUser = await post(analyze, DAILY, { uid: "nobody" });
  check(unknownUser.status === 404 && globalThis.__FS.size === 0, "모르는 사용자는 404 (횟수를 쓰지 않는다)");
}

/* ── 3. 종류별 · 사용자별로 따로 센다 ─────────────────────────── */
{
  reset();
  for (let i = 0; i < 6; i++) await doAnalyze();
  check((await doAnalyze()).status === 429, "일간 분석 상한을 채운 사용자는 막히지만");
  check((await doChat()).status === 200 && (await doWeekly()).status === 200, "채팅 · 주간은 따로 센다 (일간 분석 상한이 다른 종류를 막지 않는다)");
  check((await doAnalyze({ uid: "u2" })).status === 200, "다른 사용자는 영향이 없다 (남이 내 횟수를 쓰지 않는다)");
  const u1 = stored("u1", todayKey());
  check(u1.analyze === 6 && u1.chat === 1 && u1.weekly === 1, "저장된 횟수 — 일간 6 · 채팅 1 · 주간 1", JSON.stringify(u1));
}

/* ── 4. 동시에 와도 상한을 넘기지 못한다 ──────────────────────── */
{
  reset();
  const burst = await Promise.all(Array.from({ length: 30 }, () => doAnalyze()));
  const ok = burst.filter((r) => r.status === 200).length;
  const blocked = burst.filter((r) => r.status === 429).length;
  check(ok === 6 && blocked === 24 && globalThis.__GEMINI === 6, "30개가 한꺼번에 와도 정확히 6개만 통과하고 24개는 429 — Gemini는 6번만 불린다", `통과 ${ok} · 차단 ${blocked} · Gemini ${globalThis.__GEMINI}`);
  check(stored("u1", todayKey()).analyze === 6, "저장된 횟수도 6 (7이 되지 않는다)", String(stored("u1", todayKey()).analyze));
  check(globalThis.__RETRIES > 0, "동시 요청은 트랜잭션이 실제로 부딪쳐 다시 시도했다 (시험이 경쟁을 만들었다)", `재시도 ${globalThis.__RETRIES}번`);
  reset();
  const mixed = await Promise.all([...Array.from({ length: 10 }, () => doWeekly()), ...Array.from({ length: 10 }, () => doChat())]);
  check(mixed.slice(0, 10).filter((r) => r.status === 200).length === 3 && mixed.slice(10).every((r) => r.status === 200), "종류가 섞여 동시에 와도 각자 센다 — 주간은 3번만 · 채팅은 10번 모두 통과");
}

/* ── 5. 날짜 경계 (KST) ───────────────────────────────────────── */
{
  reset();
  const at = (iso) => Date.parse(iso);
  // KST 2026-10-27 23:59 = UTC 14:59 → 아직 10/27
  await usage.consumeAiCall("u1", "analyze", at("2026-10-27T14:59:00Z"));
  check(stored("u1", "2026-10-27")?.analyze === 1 && stored("u1", "2026-10-28") === undefined, "KST 23:59(UTC 14:59)는 그날(10/27)로 센다");
  // KST 2026-10-28 00:00 = UTC 15:00 → 새 날
  await usage.consumeAiCall("u1", "analyze", at("2026-10-27T15:00:00Z"));
  check(stored("u1", "2026-10-28")?.analyze === 1 && stored("u1", "2026-10-27").analyze === 1, "KST 자정(UTC 15:00)에 새 날(10/28)로 넘어가 0부터 센다 (UTC 자정이 아니다)");
  // 어제 상한을 다 썼어도 오늘은 다시 쓸 수 있다
  for (let i = 0; i < 5; i++) await usage.consumeAiCall("u1", "analyze", at("2026-10-27T10:00:00Z"));
  let blockedYesterday = false;
  try {
    await usage.consumeAiCall("u1", "analyze", at("2026-10-27T10:30:00Z"));
  } catch (e) {
    blockedYesterday = e.status === 429;
  }
  check(blockedYesterday, "그날 상한을 채우면 같은 날 안에서는 429");
  await usage.consumeAiCall("u1", "analyze", at("2026-10-28T10:30:00Z"));
  check(stored("u1", "2026-10-28").analyze === 2, "다음 날은 막히지 않고 이어서 센다");
}

/* ── 6. 저장 경로 · 깨진 값 · Gemini 실패 ────────────────────── */
{
  reset();
  check(usage.aiUsagePath("u1", Date.parse("2026-10-27T14:59:00Z")) === "users/u1/aiUsage/2026-10-27", "저장 경로 — 서버 전용 users/{uid}/aiUsage/{KST 날짜}");
  // 깨진 저장 값은 0으로 본다 (음수 · 문자열 · NaN) — 막히거나 터지지 않는다
  for (const broken of [-5, "7", null, Number.NaN, 2.9]) {
    reset();
    globalThis.__FS.set(`users/u1/aiUsage/${todayKey()}`, { data: { analyze: broken }, version: 1 });
    const r = await doAnalyze();
    const after = stored("u1", todayKey()).analyze;
    check(r.status === 200 && after === (broken === 2.9 ? 3 : 1), `저장 값이 ${JSON.stringify(broken)}이어도 터지지 않는다`, `다음 값 ${after}`);
  }
  reset();
  globalThis.__GEMINI_FAIL = true;
  const realError = console.error;
  console.error = () => {}; // 라우트가 Gemini 장애를 서버 로그로 남기는 것을 가린다
  const failed = await doAnalyze();
  check(failed.status === 500 && stored("u1", todayKey()).analyze === 1, "Gemini가 실패해도 횟수는 센다 (실패를 무한히 되풀이해 비용을 내지 못하게)", String(failed.status));
  for (let i = 0; i < 5; i++) await doAnalyze();
  check((await doAnalyze()).status === 429 && globalThis.__GEMINI === 6, "실패한 호출도 상한에 포함된다 — 6번째 실패 뒤에는 Gemini를 부르기 전에 429");
  console.error = realError;
}

if (failures.length) {
  console.error(`\n실패 ${failures.length}건: ${failures.join(" · ")}`);
  process.exit(1);
}
console.log("\nM9 AI 호출 상한 검증을 통과했습니다.");
