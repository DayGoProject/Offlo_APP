/**
 * M7 · 7-4 검증 — 웹 `PATCH /api/users/me`(이름 변경) 라우트를 **실제 코드 그대로** 메모리 DB에 연결해 돌린다 (Node · 네트워크 없음)
 *
 *   node scripts/verify-M7-users-api.mjs      (웹 레포가 ../Offlo 에 있어야 한다 — OFFLO_WEB_ROOT로 바꿀 수 있다)
 *
 * 웹의 `app/api/users/me/route.ts`를 그대로 import하고 `@/lib/firebase-admin`(토큰 검증만 가짜 — 에러 헬퍼는 진짜) ·
 * `@/lib/prisma`(메모리 사용자 표)만 바꿔 끼운다. 토큰 검증은 `Authorization: Bearer <uid>`를 uid로 본다.
 * **진짜 Supabase · 배포된 서버에서의 동작은 확인하지 못한다** — 웹을 배포한 뒤 앱 설정 화면에서 한 번 눌러 보는 점검이 따로 필요하다.
 * (회원 탈퇴 `DELETE`는 Firebase Auth · Firestore를 지우는 라우트라 이 스크립트가 부르지 않는다.)
 *
 * 확인 항목
 *   1. 인증 · 입력 검증 — 토큰 없음 401 · 본문 오류 400 · 이름 비어 있음 · 공백만 · 101자 · 문자가 아님 · 사용자 없음 404
 *   2. 저장 — 앞뒤 공백을 자르고 저장 · 응답 모양(`user`) · 이메일 · 플랜 · 다른 사용자는 그대로 · 이름 외 필드(email · premium)는 무시
 *   3. 같은 요청을 두 번 보내도 결과가 같다 (앱이 네트워크 실패를 한 번 다시 보내도 안전하다) · 한글 · 이모지 이름
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

/* ── 가짜 firebase-admin · prisma ────────────────────────────── */
const REAL_ADMIN = pathToFileURL(join(WEB_SRC, "lib", "firebase-admin.ts")).href;
const FAKE_ADMIN = "offlo-fake:firebase-admin";
const FAKE_ADMIN_SOURCE = `
export { apiError, handleApiError } from ${JSON.stringify(REAL_ADMIN)};
import { apiError } from ${JSON.stringify(REAL_ADMIN)};
export function getAdminFirestore() { throw new Error("이 검증은 Firestore를 쓰지 않는다"); }
export async function verifyIdToken(req) {
  const h = req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) throw apiError("인증이 필요합니다.", 401);
  return h.slice(7); // 가짜: 토큰 = uid
}
`;
const FAKE_PRISMA = "offlo-fake:prisma";
const FAKE_PRISMA_SOURCE = `
const users = () => globalThis.__FAKE_USERS;
const pick = (u, select) => {
  if (!u) return null;
  if (!select) return { ...u };
  return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, u[k]]));
};
export const prisma = {
  user: {
    findUnique: async ({ where, select }) => pick(users().get(where.uid), select),
    update: async ({ where, data, select }) => {
      const u = users().get(where.uid);
      if (!u) throw new Error("Record to update not found");
      Object.assign(u, data);
      globalThis.__FAKE_USER_WRITES++;
      return pick(u, select);
    },
  },
};
`;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@/lib/firebase-admin") return { url: FAKE_ADMIN, shortCircuit: true };
    if (specifier === "@/lib/prisma") return { url: FAKE_PRISMA, shortCircuit: true };
    if (specifier.startsWith("@/")) {
      const base = join(WEB_SRC, specifier.slice(2));
      const file = [".ts", ".tsx", "/index.ts"].map((ext) => base + ext).find(existsSync);
      if (file) return next(pathToFileURL(file).href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === FAKE_ADMIN) return { format: "module", source: FAKE_ADMIN_SOURCE, shortCircuit: true };
    if (url === FAKE_PRISMA) return { format: "module", source: FAKE_PRISMA_SOURCE, shortCircuit: true };
    return next(url, context);
  },
});

const route = await import(pathToFileURL(join(WEB_SRC, "app", "api", "users", "me", "route.ts")).href);

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};

/* ── 도구 ────────────────────────────────────────────────────── */
const CREATED = new Date("2026-08-01T00:00:00.000Z");
const reset = () => {
  globalThis.__FAKE_USERS = new Map([
    ["u1", { id: "id-1", uid: "u1", email: "u1@example.com", name: "지우", premium: false, createdAt: CREATED }],
    ["u2", { id: "id-2", uid: "u2", email: "u2@example.com", name: "민준", premium: true, createdAt: CREATED }],
  ]);
  globalThis.__FAKE_USER_WRITES = 0;
};
const patch = async (body, { uid = "u1", auth = true, raw = null } = {}) => {
  const res = await route.PATCH(
    new Request("http://localhost/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${uid}` } : {}) },
      body: raw ?? JSON.stringify(body),
    }),
  );
  return { status: res.status, json: await res.json() };
};
const user = (uid) => globalThis.__FAKE_USERS.get(uid);
const writes = () => globalThis.__FAKE_USER_WRITES;

/* ── 1. 인증 · 입력 검증 ─────────────────────────────────────── */
{
  reset();
  const noAuth = await patch({ name: "새 이름" }, { auth: false });
  check(noAuth.status === 401 && noAuth.json.error === "인증이 필요합니다.", "토큰이 없으면 401 (한국어 메시지)", JSON.stringify(noAuth.json));
  const bad = await patch(undefined, { raw: "이건 JSON이 아님" });
  check(bad.status === 400 && bad.json.error.includes("요청 본문"), "본문이 JSON이 아니면 400", JSON.stringify(bad.json));

  const wrong = [{}, { name: "" }, { name: "   " }, { name: "\n\t " }, { name: 123 }, { name: null }, { name: ["가"] }, { name: { a: 1 } }, { name: "가".repeat(101) }, { nombre: "x" }];
  const statuses = [];
  for (const body of wrong) statuses.push((await patch(body)).status);
  check(statuses.every((s) => s === 400), "이름이 없거나 · 비었거나 · 공백만이거나 · 문자가 아니거나 · 101자면 400", statuses.join(","));
  const msg = await patch({ name: "가".repeat(101) });
  check(msg.json.error === "이름은 1~100자여야 합니다.", "거절 문구는 한국어", msg.json.error);
  check(user("u1").name === "지우" && writes() === 0, "거절된 요청은 아무것도 쓰지 않는다");

  const missing = await patch({ name: "새 이름" }, { uid: "ghost" });
  check(missing.status === 404 && missing.json.error === "사용자를 찾을 수 없습니다.", "가입 기록이 없는 사용자는 404 (이름을 만들어 주지 않는다)", JSON.stringify(missing.json));
  check(writes() === 0 && !globalThis.__FAKE_USERS.has("ghost"), "404일 때도 쓰지 않는다");
}

/* ── 2. 저장 ─────────────────────────────────────────────────── */
{
  reset();
  const ok = await patch({ name: "  새 이름  " });
  check(ok.status === 200 && ok.json.user.name === "새 이름", "저장 — 앞뒤 공백을 자르고 저장한 이름을 돌려준다", JSON.stringify(ok.json));
  check(user("u1").name === "새 이름" && writes() === 1, "표에 반영 · 쓰기 한 번");
  const keys = Object.keys(ok.json.user).sort().join();
  check(keys === "createdAt,email,id,name,premium,uid", "응답 모양 — id · uid · email · name · premium · createdAt (GET /api/users/me와 같다)", keys);
  check(ok.json.user.email === "u1@example.com" && ok.json.user.premium === false && ok.json.user.uid === "u1", "이메일 · 플랜 · uid는 그대로");
  check(user("u2").name === "민준" && user("u2").premium === true, "다른 사용자는 그대로");

  // 이름 외 필드는 무시한다 — 플랜 · 이메일을 이 라우트로 바꿀 수 없다
  const sneaky = await patch({ name: "이름만", email: "attacker@example.com", premium: true, uid: "u2", id: "id-2" });
  check(sneaky.status === 200 && user("u1").email === "u1@example.com" && user("u1").premium === false && user("u1").uid === "u1" && user("u1").id === "id-1", "이름 외 필드(email · premium · uid · id)를 보내도 무시한다", JSON.stringify(user("u1")));
  check(user("u2").name === "민준", "다른 uid를 본문에 넣어도 남의 이름은 못 바꾼다 (토큰의 uid만 쓴다)");

  const one = await patch({ name: "가" });
  const hundred = await patch({ name: "가".repeat(100) });
  check(one.status === 200 && hundred.status === 200 && user("u1").name.length === 100, "1자 · 100자는 통과");
}

/* ── 3. 멱등 · 한글 ──────────────────────────────────────────── */
{
  reset();
  const first = await patch({ name: "도윤" });
  const second = await patch({ name: "도윤" });
  check(first.status === 200 && second.status === 200 && JSON.stringify(first.json) === JSON.stringify(second.json) && user("u1").name === "도윤", "같은 요청을 두 번 보내도 같은 결과 (앱이 네트워크 실패를 한 번 다시 보내도 안전하다)");
  const emoji = await patch({ name: "지우 🌱" });
  check(emoji.status === 200 && user("u1").name === "지우 🌱", "한글 · 이모지 이름");
  const keep = await patch({ name: "지우" });
  check(keep.json.user.name === "지우" && user("u1").name === "지우", "원래 이름으로 되돌릴 수 있다");
}

if (failures.length) {
  console.error(`\n실패 ${failures.length}건: ${failures.join(" · ")}`);
  process.exit(1);
}
console.log("\nM7 이름 변경 API 검증을 통과했습니다.");
