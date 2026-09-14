/**
 * M3 검증 — API 클라이언트 동작 (Node · 가짜 fetch · 에이전트 자동 실행용)
 *
 *   node scripts/verify-M3-client.mjs
 *
 * src/services/api-client.ts 는 앱 모듈을 런타임에 import하지 않아 Node(타입 제거 실행)로 바로 돌린다.
 * 실제 서버·네트워크 없이 오프라인 · 타임아웃 · 일시 장애 · 토큰 만료 · 취소를 결정적으로 재현한다.
 *
 * 확인 항목
 *   1. 요청 모양 — URL · 쿼리 · 인증 헤더 · 본문
 *   2. 오프라인 · 타임아웃 · 502~504 → 조회만 재시도, 끝내 실패하면 한국어 메시지
 *   3. 두 번 보내면 안 되는 요청(AI · 경험치 · 좋아요 · 생성)은 재시도하지 않는다
 *   4. AI 호출은 긴 타임아웃을 쓴다 (Vercel 60초 상한)
 *   5. 401 → 토큰을 새로 받아 한 번만 다시 보낸다
 *   6. 서버 한국어 메시지(409 등) · 204 · HTML 에러 페이지 · 취소 · 로그인 전
 */
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { createApiClient, ApiError, API_MESSAGES } = await import(
  pathToFileURL(join(ROOT, "src", "services", "api-client.ts")).href
);

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};

/* ── 가짜 fetch ────────────────────────────────────────────── */

const json = (data, status = 200) => async () => new Response(JSON.stringify(data), { status });
const html = (status) => async () => new Response("<html><body>Gateway Timeout</body></html>", { status });
const noContent = () => async () => new Response(null, { status: 204 });
const offline = () => async () => {
  throw new TypeError("Network request failed");
};
const abortError = () => new DOMException("The operation was aborted.", "AbortError");
/** 취소될 때까지 응답하지 않는다 */
const hang = () => (init) =>
  new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(abortError())));
/** ms 뒤에 응답한다 (그 전에 취소되면 실패) */
const delayed = (ms, data) => (init) =>
  new Promise((res, reject) => {
    const t = setTimeout(() => res(new Response(JSON.stringify(data), { status: 200 })), ms);
    init.signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(abortError());
    });
  });

/** steps[i]는 i번째 호출의 응답. 모자라면 마지막 것을 반복한다 */
function scenario(steps, { token = async () => "tok-1" } = {}) {
  const calls = [];
  const tokenCalls = [];
  const client = createApiClient({
    baseUrl: "https://api.test",
    getToken: async (forceRefresh) => {
      tokenCalls.push(forceRefresh);
      return token(forceRefresh);
    },
    fetch: async (url, init) => {
      const step = steps[Math.min(calls.length, steps.length - 1)];
      calls.push({ url, init });
      return step(init);
    },
    retryDelaysMs: [0, 0],
    timeouts: { default: 40, ai: 250 },
  });
  return { client, calls, tokenCalls };
}

async function attempt(promise) {
  try {
    return { value: await promise };
  } catch (error) {
    return { error };
  }
}

/* ── 1. 요청 모양 ──────────────────────────────────────────── */
{
  const s = scenario([json({ user: { name: "테스트" } })]);
  const { value } = await attempt(s.client.users.me());
  const headers = s.calls[0]?.init.headers ?? {};
  check(value?.user?.name === "테스트", "조회 성공 → 응답 본문 반환");
  check(s.calls[0]?.url === "https://api.test/api/users/me", "URL = baseUrl + 경로", s.calls[0]?.url);
  check(headers.Authorization === "Bearer tok-1", "Authorization: Bearer <ID 토큰>");
  check(!("Content-Type" in headers) && s.calls[0]?.init.body === undefined, "본문 없는 요청엔 Content-Type 없음");
}
{
  const s = scenario([json({ analyses: [] })]);
  await s.client.analyses.list({ periodType: "daily", limit: 7, includeApps: true });
  check(
    s.calls[0]?.url === "https://api.test/api/analyses?periodType=daily&limit=7&includeApps=1",
    "쿼리 문자열 (includeApps → 1)",
    s.calls[0]?.url,
  );
}
{
  const s = scenario([json({ user: {} })]);
  await s.client.users.ensure({ email: "a@b.c", name: "가나" });
  const init = s.calls[0]?.init;
  check(
    init?.method === "POST" && init.headers["Content-Type"] === "application/json" && init.body === '{"email":"a@b.c","name":"가나"}',
    "본문 있는 요청 → JSON + Content-Type",
  );
}
{
  const s = scenario([json({ analysis: {} })]);
  await s.client.analyses.get("a/b?c");
  check(s.calls[0]?.url.endsWith("/api/analyses/a%2Fb%3Fc"), "경로 ID 인코딩", s.calls[0]?.url);
}

/* ── 2. 오프라인 · 타임아웃 · 일시 장애 ────────────────────── */
{
  const s = scenario([offline()]);
  const { error } = await attempt(s.client.users.me());
  check(s.calls.length === 3, "오프라인 조회 → 2회 재시도 (총 3회)", `${s.calls.length}회`);
  check(
    error instanceof ApiError && error.kind === "network" && error.message === API_MESSAGES.network,
    "끝내 실패 → network 에러 + 한국어 메시지",
    error?.message,
  );
}
{
  const s = scenario([offline(), json({ user: { name: "복구" } })]);
  const { value } = await attempt(s.client.users.me());
  check(value?.user?.name === "복구" && s.calls.length === 2, "오프라인 → 재시도에서 복구", `${s.calls.length}회`);
}
{
  const s = scenario([hang()]);
  const started = Date.now();
  const { error } = await attempt(s.client.badges.list());
  check(
    error?.kind === "timeout" && error.message === API_MESSAGES.timeout && s.calls.length === 3,
    "응답 없음 → 타임아웃 · 재시도 후 timeout 에러",
    `${s.calls.length}회 · ${Date.now() - started}ms`,
  );
}
{
  const s = scenario([json({ error: "busy" }, 503), json({ goals: [] })]);
  const { value } = await attempt(s.client.goals.list("active"));
  check(Array.isArray(value?.goals) && s.calls.length === 2, "503 → 재시도에서 복구", `${s.calls.length}회`);
}
{
  const s = scenario([html(504)]);
  const { error } = await attempt(s.client.notifications.list());
  check(
    error?.kind === "http" && error.status === 504 && error.message === API_MESSAGES.server && s.calls.length === 3,
    "504 HTML 페이지 → 재시도 후 서버 장애 한국어 메시지",
    error?.message,
  );
}

/* ── 3. 두 번 보내면 안 되는 요청 ──────────────────────────── */
const neverRetry = [
  ["ai.analyze", (c) => c.ai.analyze({ imageBase64: "x", mimeType: "image/jpeg" })],
  ["ai.chat", (c) => c.ai.chat({ analysisId: "a", messages: [], analysisContext: {} })],
  ["analyses.create", (c) => c.analyses.create({ periodType: "daily" })],
  ["garden.addPlantExp", (c) => c.garden.addPlantExp(30)],
  ["community.toggleLike", (c) => c.community.toggleLike("p1")],
  ["community.createPost", (c) => c.community.createPost("안녕")],
  ["goals.create", (c) => c.goals.create({ title: "t", targetMinutes: 60, startDate: "", endDate: "" })],
  ["goals.update", (c) => c.goals.update("g1", { status: "completed" })],
  ["users.deleteMe", (c) => c.users.deleteMe()],
];
for (const [name, call] of neverRetry) {
  const s = scenario([offline()]);
  const { error } = await attempt(call(s.client));
  check(s.calls.length === 1 && error?.kind === "network", `재시도 안 함: ${name}`, `${s.calls.length}회`);
}
const safeRetry = [
  ["users.ensure", (c) => c.users.ensure({ email: "a@b.c", name: "n" })],
  ["garden.selectAnimal", (c) => c.garden.selectAnimal("cat", false)],
  ["notifications.markRead", (c) => c.notifications.markRead("n1")],
  ["notifications.markAllRead", (c) => c.notifications.markAllRead()],
];
for (const [name, call] of safeRetry) {
  const s = scenario([offline()]);
  await attempt(call(s.client));
  check(s.calls.length === 3, `재시도 함 (덮어쓰기라 안전): ${name}`, `${s.calls.length}회`);
}
{
  const s = scenario([hang()]);
  const { error } = await attempt(s.client.ai.analyze({ imageBase64: "x", mimeType: "image/jpeg" }));
  check(error?.kind === "timeout" && s.calls.length === 1, "AI 분석 타임아웃 → 다시 보내지 않음", `${s.calls.length}회`);
}

/* ── 4. AI 전용 긴 타임아웃 ────────────────────────────────── */
{
  // 기본 40ms · AI 250ms 로 줄여 둔 상태 — 120ms 걸리는 응답
  const plain = scenario([delayed(120, { user: {} })]);
  const ai = scenario([delayed(120, { analysisData: { detoxScore: 70 } })]);
  const [p, a] = await Promise.all([
    attempt(plain.client.users.me()),
    attempt(ai.client.ai.analyze({ imageBase64: "x", mimeType: "image/jpeg" })),
  ]);
  check(p.error?.kind === "timeout", "일반 요청은 기본 타임아웃에 걸림");
  check(a.value?.analysisData?.detoxScore === 70, "같은 지연이라도 AI 요청은 기다린다");
}

/* ── 5. 토큰 만료 ──────────────────────────────────────────── */
{
  let n = 0;
  const s = scenario([json({ error: "토큰 만료" }, 401), json({ user: { name: "재발급" } })], {
    token: async () => `tok-${++n}`,
  });
  const { value } = await attempt(s.client.users.me());
  check(
    value?.user?.name === "재발급" &&
      s.tokenCalls.join(",") === "false,true" &&
      s.calls[1]?.init.headers.Authorization === "Bearer tok-2",
    "401 → 토큰 강제 갱신 후 한 번 다시 보냄",
    `getToken(${s.tokenCalls.join(", ")})`,
  );
}
{
  const s = scenario([json({ error: "토큰 만료" }, 401)]);
  const { error } = await attempt(s.client.garden.addPlantExp(10));
  check(
    error?.kind === "unauthorized" && error.message === API_MESSAGES.unauthorized && s.calls.length === 2,
    "갱신해도 401 → 로그인 만료 한국어 메시지 (재시도 없는 요청도 토큰 갱신은 1회)",
    `${s.calls.length}회`,
  );
}
{
  const s = scenario([json({})], { token: async () => null });
  const { error } = await attempt(s.client.users.me());
  check(
    error?.kind === "unauthorized" && error.message === API_MESSAGES.signInRequired && s.calls.length === 0,
    "로그인 전 → 요청을 보내지 않고 막음",
  );
}
{
  const s = scenario([json({})], {
    token: async () => {
      throw Object.assign(new Error("offline"), { code: "auth/network-request-failed" });
    },
  });
  const { error } = await attempt(s.client.users.me());
  check(
    error?.kind === "network" && s.calls.length === 0 && s.tokenCalls.length === 3,
    "오프라인이라 토큰 갱신 실패 → network 에러 (조회라 재시도)",
    `getToken ${s.tokenCalls.length}회`,
  );
}

/* ── 6. 서버 메시지 · 204 · 취소 ───────────────────────────── */
{
  const msg = "오늘은 이미 일간 분석을 완료했습니다. 일간 분석은 하루에 한 번만 가능합니다.";
  const s = scenario([json({ error: msg }, 409)]);
  const { error } = await attempt(s.client.analyses.create({ periodType: "daily" }));
  check(error?.kind === "http" && error.status === 409 && error.message === msg, "409 → 서버 한국어 메시지 그대로");
}
{
  const s = scenario([json({}, 418)]);
  const { error } = await attempt(s.client.badges.list());
  check(error?.message === `${API_MESSAGES.unknown} (418)`, "메시지 없는 4xx → 기본 문구 + 상태 코드", error?.message);
}
{
  const s = scenario([noContent()]);
  const { value, error } = await attempt(s.client.goals.remove("g1"));
  check(!error && value === null, "204 No Content → null");
}
{
  const s = scenario([hang()]);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 10);
  const { error } = await attempt(s.client.users.me(controller.signal));
  check(error?.kind === "aborted" && s.calls.length === 1, "화면이 취소 → aborted · 재시도 안 함");
}
{
  const s = scenario([offline()]);
  const controller = new AbortController();
  controller.abort();
  const { error } = await attempt(s.client.users.me(controller.signal));
  check(error?.kind === "aborted" && s.calls.length === 0, "이미 취소된 요청 → 보내지 않음");
}

if (failures.length) {
  console.error(`\nM3 클라이언트 검증 실패 ${failures.length}건: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nM3 클라이언트 검증을 통과했습니다.");
