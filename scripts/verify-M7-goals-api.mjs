/**
 * M7 · 7-1 검증 — 웹 `PATCH /api/goals/[id]`의 **완료 보상이 한 번만 지급되는가**를 실제 라우트 코드 그대로 메모리 DB에 연결해 돌린다 (Node · 네트워크 없음)
 *
 *   node scripts/verify-M7-goals-api.mjs      (웹 레포가 ../Offlo 에 있어야 한다 — OFFLO_WEB_ROOT로 바꿀 수 있다)
 *
 * 배경: 예전 라우트는 `status: "completed"`를 **보낼 때마다** 식물 경험치 +20분을 줬다. 이미 완료한 목표를 반복해서 완료로 보내거나
 * 완료 → 진행 중 → 완료를 되풀이하면 경험치를 끝없이 올릴 수 있었다. 라우트를 고쳤다(처음 완료될 때 한 번만 · 완료는 되돌리지 않는다).
 * `@/lib/firebase-admin`(토큰 검증만 가짜) · `@/lib/prisma`(메모리 표) · `@/lib/garden`(보상 호출을 세기만 한다)을 바꿔 끼운다.
 * **진짜 Supabase · 배포된 서버에서의 동작은 확인하지 못한다** — 웹을 배포한 뒤 한 번 확인한다.
 *
 * 확인 항목
 *   1. 인증 · 소유 · 입력 검증 — 401 · 404 · 403 · 잘못된 본문 · 빈 수정 · 잘못된 값
 *   2. 처음 완료 — 상태가 completed가 되고 보상이 한 번 · 같은 사용자 · 응답에 목표
 *   3. 이미 완료한 목표를 다시 완료로 보내도 보상은 더 없다 (여러 번 · 다른 필드와 함께)
 *   4. 같은 완료 요청이 동시에 와도 보상은 한 번 (읽고 쓰는 사이에 겹친 경우)
 *   5. 일시정지 → 완료는 보상 · 진행 중 ↔ 일시정지는 보상 없음
 *   6. 완료한 목표를 진행 중 · 일시정지로 되돌리는 요청은 409 (되돌렸다 다시 완료해 보상을 반복해서 받는 길을 막는다) · 제목 등 다른 수정은 된다
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
    export function getAdminFirestore() { throw new Error("쓰지 않는다"); }
    export async function verifyIdToken(req) {
      const h = req.headers.get("Authorization");
      if (!h?.startsWith("Bearer ")) throw apiError("인증이 필요합니다.", 401);
      return h.slice(7); // 가짜: 토큰 = uid
    }`,
  "@/lib/prisma": `
    const users = () => globalThis.__USERS;
    const goals = () => globalThis.__GOALS;
    const tick = () => new Promise((r) => setImmediate(r)); // 요청이 서로 끼어들 틈 (실제 DB 왕복)
    const pick = (o, select) => (!o ? null : !select ? { ...o } : Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, o[k]])));
    export const prisma = {
      user: { findUnique: async ({ where, select }) => (await tick(), pick(users().get(where.uid), select)) },
      goal: {
        findUnique: async ({ where, select }) => (await tick(), pick(goals().get(where.id), select)),
        update: async ({ where, data }) => { await tick(); const g = goals().get(where.id); Object.assign(g, data); return { ...g }; },
        // 조건부 갱신 — 조건을 보고 바꾸는 것이 한 번에 일어난다 (DB의 원자적 UPDATE ... WHERE)
        updateMany: async ({ where, data }) => {
          await tick();
          const g = goals().get(where.id);
          if (!g) return { count: 0 };
          if (where.status?.not !== undefined && g.status === where.status.not) return { count: 0 };
          Object.assign(g, data);
          return { count: 1 };
        },
      },
    };`,
  "@/lib/garden": `
    export async function onGoalCompleted(uid, userId) { globalThis.__REWARDS.push({ uid, userId }); }`,
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

const route = await import(pathToFileURL(join(WEB_SRC, "app", "api", "goals", "[id]", "route.ts")).href);

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};

/* ── 도구 ────────────────────────────────────────────────────── */
const goal = (id, userId, status = "active") => ({
  id,
  userId,
  title: "하루 4시간 이하",
  targetMinutes: 240,
  startDate: new Date("2026-09-14T00:00:00.000Z"),
  endDate: new Date("2026-09-20T00:00:00.000Z"),
  status,
  createdAt: new Date("2026-09-14T03:00:00.000Z"),
});
const reset = (...goals) => {
  globalThis.__USERS = new Map([
    ["u1", { id: "id-1" }],
    ["u2", { id: "id-2" }],
  ]);
  globalThis.__GOALS = new Map(goals.map((g) => [g.id, g]));
  globalThis.__REWARDS = [];
};
const patch = async (id, body, { uid = "u1", auth = true, raw = null } = {}) => {
  const res = await route.PATCH(
    new Request(`http://localhost/api/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${uid}` } : {}) },
      body: raw ?? JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
  return { status: res.status, json: await res.json() };
};
const state = (id) => globalThis.__GOALS.get(id);
const rewards = () => globalThis.__REWARDS.length;
const flush = () => new Promise((r) => setTimeout(r, 20)); // 보상 호출은 응답 뒤 `.catch`로 이어 붙는다

/* ── 1. 인증 · 소유 · 입력 검증 ──────────────────────────────── */
{
  reset(goal("g1", "id-1"), goal("g2", "id-2"));
  const noAuth = await patch("g1", { status: "completed" }, { auth: false });
  check(noAuth.status === 401, "토큰이 없으면 401", JSON.stringify(noAuth.json));
  check((await patch("없는목표", { status: "completed" })).status === 404, "없는 목표는 404");
  const other = await patch("g2", { status: "completed" });
  check(other.status === 403 && state("g2").status === "active", "남의 목표는 403 · 바뀌지 않는다");
  check((await patch("g1", undefined, { raw: "JSON 아님" })).status === 400, "본문이 JSON이 아니면 400");
  check((await patch("g1", {})).status === 400 && (await patch("g1", { 뭔가: 1 })).status === 400, "수정할 필드가 없으면 400");
  check((await patch("g1", { status: "done" })).status === 400 && (await patch("g1", { title: "  " })).status === 400 && (await patch("g1", { targetMinutes: 0 })).status === 400, "잘못된 status · 제목 · 시간은 400");
  await flush();
  check(rewards() === 0 && state("g1").status === "active", "거절된 요청에는 보상도 변경도 없다");
}

/* ── 2. 처음 완료 ────────────────────────────────────────────── */
{
  reset(goal("g1", "id-1"));
  const done = await patch("g1", { status: "completed" });
  await flush();
  check(done.status === 200 && done.json.goal.status === "completed" && state("g1").status === "completed", "처음 완료 — 상태가 completed로", JSON.stringify(done.json.goal?.status));
  check(rewards() === 1 && globalThis.__REWARDS[0].uid === "u1" && globalThis.__REWARDS[0].userId === "id-1", "보상은 한 번 · 완료한 사용자에게", JSON.stringify(globalThis.__REWARDS));
}

/* ── 3. 이미 완료한 목표를 다시 완료로 ────────────────────────── */
{
  reset(goal("g1", "id-1"));
  await patch("g1", { status: "completed" });
  for (let i = 0; i < 5; i++) await patch("g1", { status: "completed" });
  await flush();
  check(rewards() === 1, "완료를 여섯 번 보내도 보상은 한 번뿐 (예전에는 여섯 번)", `${rewards()}번`);
  const mixed = await patch("g1", { status: "completed", title: "제목도 바꿈" });
  await flush();
  check(mixed.status === 200 && state("g1").title === "제목도 바꿈" && state("g1").status === "completed" && rewards() === 1, "이미 완료한 목표에 \"완료 + 제목\"을 보내도 제목만 바뀌고 보상은 그대로");
}

/* ── 4. 동시에 온 완료 요청 ───────────────────────────────────── */
{
  reset(goal("g1", "id-1"));
  const results = await Promise.all([patch("g1", { status: "completed" }), patch("g1", { status: "completed" }), patch("g1", { status: "completed" })]);
  await flush();
  check(results.every((r) => r.status === 200 && r.json.goal.status === "completed"), "동시에 세 번 와도 모두 정상 응답");
  check(rewards() === 1, "동시에 온 완료 요청에도 보상은 한 번뿐 (읽고 쓰는 사이에 겹쳐도)", `${rewards()}번`);
}

/* ── 5. 상태 오가기 ──────────────────────────────────────────── */
{
  reset(goal("g1", "id-1", "paused"));
  await patch("g1", { status: "completed" });
  await flush();
  check(rewards() === 1 && state("g1").status === "completed", "일시정지 → 완료는 보상 한 번");

  reset(goal("g1", "id-1"));
  await patch("g1", { status: "paused" });
  await patch("g1", { status: "active" });
  await patch("g1", { title: "이름만" });
  await patch("g1", { targetMinutes: 90, endDate: "2026-09-25" });
  await flush();
  check(rewards() === 0 && state("g1").status === "active" && state("g1").targetMinutes === 90 && state("g1").title === "이름만", "진행 중 ↔ 일시정지 · 제목 · 시간 · 기간 수정에는 보상이 없다");
}

/* ── 6. 완료는 되돌리지 않는다 ────────────────────────────────── */
{
  reset(goal("g1", "id-1"));
  await patch("g1", { status: "completed" });
  const back = await patch("g1", { status: "active" });
  const pause = await patch("g1", { status: "paused" });
  check(back.status === 409 && pause.status === 409 && back.json.error === "이미 완료한 목표의 상태는 바꿀 수 없습니다.", "완료한 목표를 진행 중 · 일시정지로 돌리면 409", JSON.stringify(back.json));
  check(state("g1").status === "completed", "되돌리기가 거절돼 상태는 완료 그대로");
  await patch("g1", { status: "active" });
  await patch("g1", { status: "completed" });
  await flush();
  check(rewards() === 1, "완료 → 진행 중 → 완료를 되풀이해도 보상은 한 번뿐 (되돌리기가 막혀 있다)", `${rewards()}번`);
  const rename = await patch("g1", { title: "완료한 목표 이름 정리" });
  check(rename.status === 200 && state("g1").title === "완료한 목표 이름 정리" && state("g1").status === "completed", "완료한 목표의 제목 같은 다른 수정은 된다");
}

if (failures.length) {
  console.error(`\n실패 ${failures.length}건: ${failures.join(" · ")}`);
  process.exit(1);
}
console.log("\nM7 목표 완료 보상 API 검증을 통과했습니다.");
