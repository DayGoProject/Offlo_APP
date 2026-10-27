/**
 * M9 검증 — 웹 `POST /api/users`가 **"Google로 처음 로그인하면 그 자리에서 가입"** 을 받쳐 주는가를 실제 라우트 코드 그대로 메모리 DB에 연결해 돌린다 (Node · 네트워크 불필요).
 *
 *   node scripts/verify-M9-signup-api.mjs      (웹 레포가 ../Offlo 에 있어야 한다 — OFFLO_WEB_ROOT로 바꿀 수 있다)
 *
 * 배경: 예전에는 앱 · 웹이 "처음 로그인한 Google 계정"을 지우고 막았다(가입은 웹 이메일/Google 가입 페이지). 이메일 가입을 없애고 Google 첫 로그인이 곧 가입이 되면서
 * 이 라우트가 가입 경로가 됐다 — 중복 로그인 · 두 기기 동시 첫 로그인 · 이메일 충돌에서 깨지지 않아야 한다.
 * **진짜 Supabase · 배포된 서버에서의 동작은 확인하지 못한다** (Prisma의 P2002 유니크 위반을 메모리 DB가 흉내 낸다).
 *
 * 확인 항목
 *   1. 처음 로그인 — 계정이 만들어지고 이름 · 이메일 · premium=false · id가 돌아온다
 *   2. 다시 로그인 — 이미 있으면 바꾸지 않는다 (이름을 나중에 바꿨어도 로그인할 때마다 덮어쓰지 않는다)
 *   3. 두 기기가 동시에 처음 로그인 — 둘 다 같은 계정을 받고 한 명만 만들어진다 (유니크 위반을 삼킨다)
 *   4. 같은 이메일의 다른 uid(예전 이메일 가입 계정) — 500이 아니라 409 + 한국어 안내
 *   5. 입력 검증(이메일 · 이름 길이) · 인증 · 남의 uid를 만들 수 없다
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

const REAL_ADMIN = pathToFileURL(join(WEB_SRC, "lib", "firebase-admin.ts")).href;
const FAKES = {
  "@/lib/firebase-admin": `
    export { apiError, handleApiError } from ${JSON.stringify(REAL_ADMIN)};
    import { apiError } from ${JSON.stringify(REAL_ADMIN)};
    export async function verifyIdToken(req) {
      const h = req.headers.get("Authorization");
      if (!h?.startsWith("Bearer ")) throw apiError("인증이 필요합니다.", 401);
      return h.slice(7); // 가짜: 토큰 = uid
    }
    // 가입은 토큰의 이메일도 본다(영구 정지된 이메일 차단) — 이 검증의 토큰에는 이메일이 없다. 제재 기록은 비어 있다 (정지 차단은 verify-M9-sanctions-api가 본다)
    export async function verifyIdTokenFull(req) {
      return { uid: await verifyIdToken(req), email: undefined };
    }
    export function getAdminFirestore() {
      return { doc: () => ({ get: async () => ({ exists: false, data: () => undefined }) }) };
    }`,
  "@/lib/prisma": `
    const tick = () => new Promise((r) => setImmediate(r)); // 읽고 쓰는 사이에 다른 요청이 끼어들 틈
    const db = () => globalThis.__DB; // uid -> 사용자
    const pick = (u, select) => (!u ? null : Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, u[k]])));
    const unique = (target) => Object.assign(new Error("Unique constraint failed on the fields: (" + target + ")"), { code: "P2002" });
    export const prisma = {
      user: {
        findUnique: async ({ where, select }) => (await tick(), pick(db().get(where.uid), select)),
        // 실제 upsert처럼 — 먼저 읽고(없으면) 만든다. 그 사이 다른 요청이 만들면 만드는 쪽이 유니크 위반을 만난다
        upsert: async ({ where, create, select }) => {
          const found = db().get(where.uid);
          await tick();
          if (found) return pick(found, select);
          if (db().has(create.uid)) throw unique("uid");
          if ([...db().values()].some((u) => u.email === create.email)) throw unique("email");
          const user = { id: "id-" + (db().size + 1), uid: create.uid, email: create.email, name: create.name, premium: false, createdAt: new Date("2026-10-27T00:00:00Z").toISOString() };
          db().set(create.uid, user);
          return pick(user, select);
        },
      },
    };`,
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

const route = await import(pathToFileURL(join(WEB_SRC, "app", "api", "users", "route.ts")).href);

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};
const reset = () => {
  globalThis.__DB = new Map();
};
const login = async (uid, body, { auth = true, raw = null } = {}) => {
  const res = await route.POST(
    new Request("http://localhost/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${uid}` } : {}) },
      body: raw ?? JSON.stringify(body),
    }),
  );
  return { status: res.status, json: await res.json() };
};
const silent = async (fn) => {
  const original = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = original;
  }
};

/* ── 1 · 2. 처음 로그인 · 다시 로그인 ─────────────────────────── */
{
  reset();
  const first = await login("u1", { email: "kim@example.com", name: "김오프" });
  check(first.status === 201 && first.json.user.uid === "u1" && first.json.user.email === "kim@example.com" && first.json.user.name === "김오프" && first.json.user.premium === false, "처음 로그인하면 계정이 만들어진다 (이름 · 이메일 · premium=false)", JSON.stringify(first.json));
  check(globalThis.__DB.size === 1, "만들어진 사용자는 하나");
  // 이름을 서버에서 바꾼 뒤 다시 로그인 — 덮어쓰지 않는다
  globalThis.__DB.get("u1").name = "새이름";
  const again = await login("u1", { email: "kim@example.com", name: "구글이름" });
  check(again.status === 201 && again.json.user.name === "새이름" && globalThis.__DB.size === 1, "다시 로그인해도 바꾸지 않는다 — 나중에 바꾼 이름을 Google 이름으로 덮어쓰지 않는다 · 중복 가입 없음");
  const spaced = await login("u2", { email: "  lee@example.com  ", name: "  이오프  " });
  check(spaced.json.user.email === "lee@example.com" && spaced.json.user.name === "이오프", "이메일 · 이름 앞뒤 공백은 다듬는다");
}

/* ── 3. 두 기기 동시에 처음 로그인 ───────────────────────────── */
{
  reset();
  const [a, b, c] = await silent(() => Promise.all([login("u1", { email: "a@example.com", name: "에이" }), login("u1", { email: "a@example.com", name: "에이" }), login("u1", { email: "a@example.com", name: "에이" })]));
  check([a, b, c].every((r) => r.status === 201 && r.json.user.uid === "u1"), "동시에 세 번 처음 로그인해도 모두 성공하고 같은 계정을 받는다", [a, b, c].map((r) => r.status).join(","));
  check(globalThis.__DB.size === 1, "계정은 하나만 만들어진다");
}

/* ── 4. 같은 이메일의 다른 계정 ──────────────────────────────── */
{
  reset();
  await login("old-email-uid", { email: "same@example.com", name: "예전" });
  const conflict = await silent(() => login("google-uid", { email: "same@example.com", name: "구글" }));
  check(conflict.status === 409 && /이미 가입된 다른 계정/.test(conflict.json.error) && !globalThis.__DB.has("google-uid"), "같은 이메일의 다른 uid(예전 이메일 가입 계정)는 500이 아니라 409 + 한국어 안내 · 새 계정은 만들지 않는다", conflict.json.error);
}

/* ── 5. 검증 · 인증 ──────────────────────────────────────────── */
{
  reset();
  check((await login("u1", { email: "x@example.com", name: "x" }, { auth: false })).status === 401, "토큰이 없으면 401");
  check((await login("u1", undefined, { raw: "JSON 아님" })).status === 400, "본문이 JSON이 아니면 400");
  check((await login("u1", { email: "메일아님", name: "이름" })).status === 400 && (await login("u1", { name: "이름" })).status === 400, "이메일이 없거나 형식이 틀리면 400");
  check((await login("u1", { email: "a@b.co", name: "   " })).status === 400 && (await login("u1", { email: "a@b.co", name: "가".repeat(101) })).status === 400, "이름이 비었거나 100자를 넘으면 400");
  check((await login("u1", { email: "a@b.co", name: "가".repeat(100) })).status === 201, "이름 100자는 통과");
  check(globalThis.__DB.size === 1, "검증에 걸린 요청은 계정을 만들지 않는다");
  // 토큰의 uid로만 만든다 — 본문에 uid를 넣어도 소용없다
  reset();
  const forged = await login("u1", { email: "a@b.co", name: "이름", uid: "u-other" });
  check(forged.json.user.uid === "u1" && !globalThis.__DB.has("u-other"), "본문의 uid는 무시한다 — 토큰의 uid로만 만든다 (남의 계정을 만들 수 없다)");
}

if (failures.length) {
  console.error(`\n실패 ${failures.length}건: ${failures.join(" · ")}`);
  process.exit(1);
}
console.log("\nM9 가입(첫 Google 로그인) 검증을 통과했습니다.");
