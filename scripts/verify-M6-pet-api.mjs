/**
 * M6 · 6-3 검증 — 웹 `POST /api/garden/pet` 라우트를 **실제 코드 그대로** 메모리 Firestore에 연결해 돌린다 (Node · 네트워크 없음)
 *
 *   node scripts/verify-M6-pet-api.mjs        (웹 레포가 ../Offlo 에 있어야 한다 — OFFLO_WEB_ROOT로 바꿀 수 있다)
 *
 * 웹의 `app/api/garden/pet/route.ts` · `animal/route.ts` · `lib/garden-utils.ts` · `lib/kst.ts`를 그대로 import하고,
 * `@/lib/firebase-admin`만 가짜로 바꿔 끼운다: 에러 헬퍼(`apiError` · `handleApiError`)는 진짜를 쓰고, Firestore는 메모리 + 트랜잭션 직렬화,
 * 토큰 검증은 `Authorization: Bearer <uid>`를 uid로 본다.
 * **진짜 Firestore · 배포된 서버에서의 동작은 확인하지 못한다** — 배포 뒤 앱에서 한 번 눌러 보는 점검이 따로 필요하다 (docs/garden-game-design.md 8-6).
 *
 * 시간대 3개(Asia/Seoul · UTC · America/Los_Angeles)에서 다시 실행해 답이 같아야 통과다 (날짜 키는 KST).
 *
 * 확인 항목
 *   1. 인증 · 입력 검증 — 토큰 없음 401 · 본문 오류 400 · count 범위 · 동물 미선택 409
 *   2. 기록 — 응답 모양 · 레벨 · 다음 레벨 · 다른 필드(streak 등)를 건드리지 않음
 *   3. 하루 상한 5 — 채우면 accepted 0(에러 아님) · 채운 뒤엔 쓰지 않음
 *   4. 두 기기 동시 — 트랜잭션이 직렬화되어 합계가 상한을 못 넘음
 *   5. 새 날(KST) — 오늘 횟수 0으로 · 누적은 이어짐
 *   6. 레벨업 경계 · 마지막 레벨
 *   7. 동물 변경(reset) — 쓰다듬기 기록도 0부터 · 첫 선택(reset=false)은 기록 유지
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ZONES = ["Asia/Seoul", "UTC", "America/Los_Angeles"];

if (!process.env.OFFLO_TZ_CHILD) {
  let failed = 0;
  for (const tz of ZONES) {
    console.log(`\n── TZ=${tz} ──`);
    const run = spawnSync(process.execPath, process.execArgv.concat(process.argv.slice(1)), {
      stdio: "inherit",
      env: { ...process.env, TZ: tz, OFFLO_TZ_CHILD: "1" },
    });
    if (run.status !== 0) failed++;
  }
  if (failed) {
    console.error(`\nM6 쓰다듬기 API 검증 실패 — ${failed}개 시간대`);
    process.exit(1);
  }
  console.log(`\nM6 쓰다듬기 API 검증을 통과했습니다 (${ZONES.join(" · ")}).`);
  process.exit(0);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_ROOT = process.env.OFFLO_WEB_ROOT ?? resolve(ROOT, "..", "Offlo");
const WEB_SRC = join(WEB_ROOT, "web", "src");
if (!existsSync(WEB_SRC)) {
  console.error(`✗ 웹 레포를 찾을 수 없습니다: ${WEB_ROOT} (OFFLO_WEB_ROOT로 지정하세요)`);
  process.exit(1);
}

/* ── 가짜 firebase-admin ─────────────────────────────────────── */
const REAL_ADMIN = pathToFileURL(join(WEB_SRC, "lib", "firebase-admin.ts")).href;
const FAKE = "offlo-fake:firebase-admin";
const FAKE_SOURCE = `
export { apiError, handleApiError } from ${JSON.stringify(REAL_ADMIN)};
import { apiError } from ${JSON.stringify(REAL_ADMIN)};

const store = () => globalThis.__FAKE_STORE;
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v);
const deepMerge = (a, b) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = isPlain(v) && isPlain(a[k]) ? deepMerge(a[k], v) : clone(v);
  return out;
};
const snap = (path) => {
  const data = store().docs.get(path);
  return { exists: data !== undefined, data: () => clone(data) };
};
const write = (path, data, opts) => {
  store().writes++;
  const prev = store().docs.get(path);
  store().docs.set(path, opts?.merge && prev ? deepMerge(prev, data) : clone(data));
};

export function getAdminFirestore() {
  return {
    doc: (path) => ({ path, get: async () => snap(path), set: async (data, opts) => write(path, data, opts) }),
    // 트랜잭션은 한 번에 하나씩 — 읽고 쓰는 사이에 다른 요청이 끼어들지 못하게 (실제 Firestore는 충돌하면 다시 시도해 같은 결과를 낸다)
    runTransaction: async (fn) => {
      const run = async () => {
        const writes = [];
        const result = await fn({
          get: async (ref) => snap(ref.path),
          set: (ref, data, opts) => void writes.push([ref.path, data, opts]),
        });
        for (const [p, d, o] of writes) write(p, d, o); // 오류 없이 끝났을 때만 반영
        return result;
      };
      const turn = store().lock.then(run, run);
      store().lock = turn.catch(() => {});
      return turn;
    },
  };
}

export async function verifyIdToken(req) {
  const h = req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) throw apiError("인증이 필요합니다.", 401);
  return h.slice(7); // 가짜: 토큰 = uid
}
`;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@/lib/firebase-admin") return { url: FAKE, shortCircuit: true };
    if (specifier.startsWith("@/")) {
      const base = join(WEB_SRC, specifier.slice(2));
      const file = [".ts", ".tsx", "/index.ts"].map((ext) => base + ext).find(existsSync);
      if (file) return next(pathToFileURL(file).href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === FAKE) return { format: "module", source: FAKE_SOURCE, shortCircuit: true };
    return next(url, context);
  },
});

const petRoute = await import(pathToFileURL(join(WEB_SRC, "app", "api", "garden", "pet", "route.ts")).href);
const animalRoute = await import(pathToFileURL(join(WEB_SRC, "app", "api", "garden", "animal", "route.ts")).href);
const utils = await import(pathToFileURL(join(WEB_SRC, "lib", "garden-utils.ts")).href);
const { kstDateKey, DAY_MS } = await import(pathToFileURL(join(WEB_SRC, "lib", "kst.ts")).href);

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};

/* ── 도구 ────────────────────────────────────────────────────── */
const PATH = (uid) => `users/${uid}/garden/animal`;
const reset = () => {
  globalThis.__FAKE_STORE = { docs: new Map(), writes: 0, lock: Promise.resolve() };
};
const seed = (uid, data) => globalThis.__FAKE_STORE.docs.set(PATH(uid), structuredClone(data));
const docOf = (uid) => globalThis.__FAKE_STORE.docs.get(PATH(uid));
const writes = () => globalThis.__FAKE_STORE.writes;

const req = (route, body, { uid = "u1", auth = true, raw = null } = {}) =>
  route.POST(
    new Request("http://localhost/api", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${uid}` } : {}) },
      body: raw ?? JSON.stringify(body),
    }),
  );
const pet = async (body, opts) => {
  const res = await req(petRoute, body, opts);
  return { status: res.status, json: await res.json() };
};

const TODAY = kstDateKey();
const YESTERDAY = kstDateKey(Date.now() - DAY_MS);
const base = { type: "cat", streak: 12, lastAnalysisDate: TODAY };

/* ── 1. 인증 · 입력 검증 ─────────────────────────────────────── */
{
  reset();
  seed("u1", base);
  const noAuth = await pet({ count: 1 }, { auth: false });
  check(noAuth.status === 401 && noAuth.json.error === "인증이 필요합니다.", "토큰이 없으면 401 (한국어 메시지)", JSON.stringify(noAuth.json));

  const bad = await pet(undefined, { raw: "이건 JSON이 아님" });
  check(bad.status === 400 && bad.json.error.includes("요청 본문"), "본문이 JSON이 아니면 400", JSON.stringify(bad.json));

  const wrong = [0, 6, -1, 1.5, "2", null, true, [1]];
  const results = [];
  for (const count of wrong) results.push((await pet({ count })).status);
  check(results.every((s) => s === 400), "count가 0 · 6 · 음수 · 소수 · 문자열 · null · 불리언 · 배열이면 400", results.join(","));
  const msg = (await pet({ count: 99 })).json.error;
  check(msg === "count는 1~5 사이의 정수여야 합니다.", "범위 오류 문구에 상한(5)이 들어간다", msg);
  check(writes() === 0 && JSON.stringify(docOf("u1")) === JSON.stringify(base), "잘못된 요청은 아무것도 쓰지 않는다");

  reset();
  const none = await pet({ count: 1 });
  check(none.status === 409 && none.json.error === "먼저 함께할 동물을 골라 주세요.", "동물 문서가 없으면 409", JSON.stringify(none.json));
  seed("u1", { streak: 0 });
  const noType = await pet({ count: 1 });
  check(noType.status === 409 && writes() === 0, "문서는 있지만 type이 없으면(미선택) 409 · 쓰지 않음");
}

/* ── 2. 기록 ─────────────────────────────────────────────────── */
{
  reset();
  seed("u1", base);
  const r = await pet({}); // count 생략 = 1
  const d = docOf("u1");
  check(r.status === 200 && r.json.ok === true && r.json.accepted === 1, "count를 생략하면 1번으로 센다", JSON.stringify(r.json));
  check(
    r.json.date === TODAY && r.json.today === 1 && r.json.cap === 5 && r.json.total === 1 &&
      r.json.level.level === 1 && r.json.level.name === "낯선 사이" &&
      r.json.nextLevel.level === 2 && r.json.nextLevel.name === "조심스러운 사이" && r.json.nextLevel.minTotal === 10,
    "응답 모양 — date · today · cap · total · level · nextLevel",
    JSON.stringify(r.json),
  );
  check(d.pet.date === TODAY && d.pet.today === 1 && d.pet.total === 1 && typeof d.lastUpdated === "string", "Firestore animal.pet에 { date, today, total }이 저장됨", JSON.stringify(d.pet));
  check(d.type === "cat" && d.streak === 12 && d.lastAnalysisDate === TODAY, "연속 기록 · 마지막 분석일 · 동물 종류는 건드리지 않는다 (merge)");
  const r3 = await pet({ count: 3 });
  check(r3.json.accepted === 3 && r3.json.today === 4 && r3.json.total === 4, "묶어 보낸 3번이 한꺼번에 반영", JSON.stringify(r3.json));
}

/* ── 3. 하루 상한 ─────────────────────────────────────────────── */
{
  reset();
  seed("u1", base);
  const a = await pet({ count: 4 });
  const b = await pet({ count: 3 });
  check(a.json.accepted === 4 && b.json.accepted === 1 && b.json.today === 5 && b.json.total === 5, "4번 + 3번 요청 → 합계 5 (두 번째는 1번만 인정)", `${a.json.accepted},${b.json.accepted}`);
  const w = writes();
  const c = await pet({ count: 2 });
  check(c.status === 200 && c.json.accepted === 0 && c.json.today === 5 && c.json.total === 5, "상한을 채운 뒤 요청은 에러가 아니라 accepted 0 (200)", `${c.status} ${JSON.stringify(c.json)}`);
  check(writes() === w, "인정된 게 없으면 Firestore에 쓰지 않는다 (쓰기 낭비 · 경쟁 방지)");
  check(c.json.cap === 5 && c.json.level.level === 1, "상한이 찬 응답에도 cap · level이 들어 있다");
}

/* ── 4. 두 기기 동시 ──────────────────────────────────────────── */
{
  reset();
  seed("u1", base);
  const [x, y, z] = await Promise.all([pet({ count: 3 }), pet({ count: 3 }), pet({ count: 3 })]);
  const sum = x.json.accepted + y.json.accepted + z.json.accepted;
  check(sum === 5 && docOf("u1").pet.today === 5 && docOf("u1").pet.total === 5, "동시에 3번씩 세 요청 → 인정 합계 5 · 누적 5 (상한을 넘지 못함)", `${x.json.accepted}+${y.json.accepted}+${z.json.accepted}`);
  seed("u2", base);
  const mixed = await Promise.all([pet({ count: 5 }, { uid: "u1" }), pet({ count: 2 }, { uid: "u2" })]);
  check(mixed[0].json.accepted === 0 && mixed[1].json.accepted === 2 && docOf("u2").pet.total === 2, "사용자마다 따로 센다 (u1은 이미 상한 · u2는 2번)");
}

/* ── 5. 새 날 ────────────────────────────────────────────────── */
{
  reset();
  seed("u1", { ...base, pet: { date: YESTERDAY, today: 5, total: 50 } });
  const r = await pet({ count: 5 });
  check(r.json.accepted === 5 && r.json.today === 5 && r.json.total === 55 && r.json.date === TODAY, "어제 상한을 채웠어도 오늘은 다시 5번 — 누적은 이어서 55", JSON.stringify(r.json));
  // 오래된 날짜 · 깨진 값
  reset();
  seed("u1", { ...base, pet: { date: "2020-01-01", today: 99, total: 7 } });
  const old = await pet({ count: 2 });
  check(old.json.accepted === 2 && old.json.today === 2 && old.json.total === 9, "아주 오래된 기록의 today(99)는 무시", JSON.stringify(old.json));
  reset();
  seed("u1", { ...base, pet: { date: "어제", today: -5, total: "많이" } });
  const broken = await pet({ count: 1 });
  check(broken.status === 200 && broken.json.today === 1 && broken.json.total === 1, "깨진 pet 값(문자열 · 음수)도 0부터 안전하게 다시 센다", JSON.stringify(broken.json));
}

/* ── 6. 레벨 경계 ─────────────────────────────────────────────── */
{
  const levelAfter = async (total) => {
    reset();
    seed("u1", { ...base, pet: { date: YESTERDAY, today: 0, total } });
    return (await pet({ count: 1 })).json;
  };
  const r9 = await levelAfter(9); // 9 + 1 = 10 → Lv2
  check(r9.total === 10 && r9.level.level === 2 && r9.level.name === "조심스러운 사이" && r9.nextLevel.minTotal === 30, "누적 9 → 10에서 Lv2 · 다음은 30", JSON.stringify(r9.level));
  const r29 = await levelAfter(29);
  check(r29.level.level === 3 && r29.level.name === "친구", "29 → 30에서 Lv3 친구");
  const r69 = await levelAfter(69);
  check(r69.level.level === 4 && r69.level.name === "단짝", "69 → 70에서 Lv4 단짝");
  const r129 = await levelAfter(129);
  check(r129.level.level === 5 && r129.level.name === "평생 가족" && r129.nextLevel === null, "129 → 130에서 Lv5 평생 가족 · 다음 레벨 없음(null)");
  const r500 = await levelAfter(500);
  check(r500.level.level === 5 && r500.nextLevel === null && r500.total === 501, "마지막 레벨을 넘어도 계속 쌓이고 레벨은 그대로");
}

/* ── 7. 동물 변경(reset) ──────────────────────────────────────── */
{
  reset();
  seed("u1", { ...base, pet: { date: TODAY, today: 3, total: 41 } });
  const keep = await req(animalRoute, { typeId: "dog", reset: false });
  check(keep.status === 200 && docOf("u1").type === "dog" && docOf("u1").pet.total === 41 && docOf("u1").streak === 12, "첫 선택(reset=false)은 기록을 그대로 둔다 (종류만 바뀜)", JSON.stringify(docOf("u1").pet));

  const swapped = await req(animalRoute, { typeId: "rabbit", reset: true });
  const d = docOf("u1");
  check(
    swapped.status === 200 && d.type === "rabbit" && d.streak === 0 && d.lastAnalysisDate === null &&
      d.pet.date === null && d.pet.today === 0 && d.pet.total === 0,
    "동물 변경(reset=true) → 연속 기록 · 마지막 분석일 · 쓰다듬기 기록이 모두 0부터 (확정 2026-10-05)",
    JSON.stringify({ streak: d.streak, pet: d.pet }),
  );
  const after = await pet({ count: 2 });
  check(after.json.accepted === 2 && after.json.total === 2 && after.json.level.level === 1, "새 동물과는 처음부터 — 친밀도 Lv1 · 누적 2");
  const badType = await req(animalRoute, { typeId: "dragon", reset: true });
  check(badType.status === 400 && docOf("u1").pet.total === 2, "잘못된 동물 종류는 400이고 기록을 지우지 않는다");
}

if (failures.length) {
  console.error(`\n실패 ${failures.length}건: ${failures.join(" · ")}`);
  process.exit(1);
}
console.log(`\n통과 (TZ=${process.env.TZ})`);
