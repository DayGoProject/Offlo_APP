/**
 * M9 검증 — 웹 **회원 탈퇴 `DELETE /api/users/me`가 `users/{uid}` 아래 모든 Firestore 데이터를 지우는가**를 실제 라우트 코드 그대로 메모리 저장소에 연결해 돌린다 (Node · 네트워크 불필요).
 *
 *   node scripts/verify-M9-account-delete.mjs      (웹 레포가 ../Offlo 에 있어야 한다 — OFFLO_WEB_ROOT로 바꿀 수 있다)
 *
 * 배경: 예전 라우트는 `users/{uid}/garden`만 지워서 알림(`notifications` — 제목 · 본문)과 AI 사용 기록(`aiUsage`)이 탈퇴 뒤에도 남았다.
 * 개인정보 처리방침(Play 데이터 보안 양식)의 "탈퇴하면 모든 데이터를 삭제한다"와 맞지 않아 `recursiveDelete`로 바꿨다.
 * **진짜 Firestore · Supabase · Firebase Auth에서의 동작은 확인하지 못한다** — 웹을 배포한 뒤 테스트 계정으로 한 번 확인한다.
 *
 * 확인 항목
 *   1. users/{uid} 문서와 그 아래 모든 하위 컬렉션(garden · notifications · aiUsage · 앞으로 생길 것)이 지워진다
 *   2. 다른 사용자의 데이터는 그대로다 (uid가 겹치는 접두어 — `u1` vs `u10` — 도 건드리지 않는다)
 *   3. 순서 — Supabase → Firestore → Firebase Auth. Firestore 삭제가 실패하면 500이고 Auth 계정은 남는다 (다시 시도할 수 있다)
 *   4. 토큰이 없으면 401 · 아무것도 지우지 않는다 · 이미 지운 계정을 다시 지워도 터지지 않는다
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
    export async function verifyIdToken(req) {
      const h = req.headers.get("Authorization");
      if (!h?.startsWith("Bearer ")) throw apiError("인증이 필요합니다.", 401);
      return h.slice(7); // 가짜: 토큰 = uid
    }
    export function getAdminFirestore() {
      return {
        doc: (path) => ({ path }),
        // 신고 원본(reports) — 신고자 uid로 찾아 지운다 (deleteReportsBy)
        collection: (path) => ({
          where: (field, _op, value) => ({
            limit: (max) => ({
              get: async () => {
                const docs = [...globalThis.__FS.entries()]
                  .filter(([p, v]) => p.startsWith(path + "/") && v?.[field] === value)
                  .slice(0, max)
                  .map(([p]) => ({ id: p.slice(path.length + 1), ref: { path: p } }));
                return { docs, empty: docs.length === 0 };
              },
            }),
          }),
        }),
        batch: () => {
          const ops = [];
          return { delete: (ref) => ops.push(ref.path), commit: async () => { globalThis.__LOG.push("reports"); for (const p of ops) globalThis.__FS.delete(p); } };
        },
        // 실제 recursiveDelete처럼 — 그 문서와 그 아래 모든 하위 컬렉션 문서 (접두어가 아니라 경로 경계로)
        recursiveDelete: async (ref) => {
          globalThis.__LOG.push("firestore");
          if (globalThis.__FIRESTORE_FAIL) throw new Error("Firestore 장애");
          for (const path of [...globalThis.__FS.keys()]) {
            if (path === ref.path || path.startsWith(ref.path + "/")) globalThis.__FS.delete(path);
          }
        },
      };
    }`,
  "@/lib/prisma": `
    export const prisma = { user: { deleteMany: async ({ where }) => { globalThis.__LOG.push("supabase"); globalThis.__DB.delete(where.uid); return { count: 1 }; } } };`,
  "firebase-admin": `
    export function auth() { return { deleteUser: async (uid) => { globalThis.__LOG.push("auth"); globalThis.__AUTH.delete(uid); } }; }
    export default { auth };`,
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

const route = await import(pathToFileURL(join(WEB_SRC, "app", "api", "users", "me", "route.ts")).href);

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};

const reset = () => {
  globalThis.__LOG = [];
  globalThis.__FIRESTORE_FAIL = false;
  globalThis.__DB = new Set(["u1", "u10", "u2"]);
  globalThis.__AUTH = new Set(["u1", "u10", "u2"]);
  globalThis.__FS = new Map(
    ["u1", "u10", "u2"].flatMap((uid) => [
      [`users/${uid}`, {}],
      [`users/${uid}/garden/plant`, {}],
      [`users/${uid}/garden/animal`, {}],
      [`users/${uid}/notifications/n1`, {}],
      [`users/${uid}/notifications/n2`, {}],
      [`users/${uid}/aiUsage/2026-10-27`, {}],
      [`users/${uid}/앞으로생길것/x`, {}],
      [`users/${uid}/blocks/someone`, {}],
      [`users/${uid}/reported/post_1`, {}],
      [`reports/${uid}_post_9`, { reporterUid: uid }],
    ]),
  );
};
const del = async (uid, auth = true) => {
  const res = await route.DELETE(new Request("http://localhost/api/users/me", { method: "DELETE", headers: auth ? { Authorization: `Bearer ${uid}` } : {} }));
  return { status: res.status, json: await res.json() };
};
const left = (uid) => [...globalThis.__FS.keys()].filter((p) => p === `users/${uid}` || p.startsWith(`users/${uid}/`) || p.startsWith(`reports/${uid}_`));

/* ── 1. u1의 모든 데이터가 지워진다 ─────────────────────────── */
{
  reset();
  const r = await del("u1");
  check(r.status === 200 && r.json.ok === true, "탈퇴 요청이 성공한다", JSON.stringify(r.json));
  check(left("u1").length === 0, "users/u1 문서와 그 아래 모든 하위 컬렉션(garden · notifications · aiUsage · blocks · reported …)과 u1이 한 신고 원본이 지워진다", left("u1").join(", "));
  check(!globalThis.__DB.has("u1") && !globalThis.__AUTH.has("u1"), "Supabase 사용자와 Firebase Auth 계정도 지워진다");
}

/* ── 2. 다른 사용자는 그대로 ─────────────────────────────────── */
{
  check(left("u2").length === 10 && globalThis.__DB.has("u2") && globalThis.__AUTH.has("u2"), "다른 사용자(u2)의 데이터는 그대로다");
  check(left("u10").length === 10 && globalThis.__DB.has("u10") && globalThis.__AUTH.has("u10"), "uid가 u1로 시작하는 다른 사용자(u10)도 건드리지 않는다 (접두어가 아니라 경로 경계로 지운다)");
}

/* ── 3. 순서 · 실패 ─────────────────────────────────────────── */
{
  reset();
  await del("u2");
  check(globalThis.__LOG.join(">") === "supabase>firestore>reports>auth", "순서 — Supabase → Firestore(users/{uid} 전체) → 이 사람이 한 신고 원본 → Firebase Auth", globalThis.__LOG.join(">"));
  reset();
  globalThis.__FIRESTORE_FAIL = true;
  const realError = console.error;
  console.error = () => {};
  const failed = await del("u1");
  console.error = realError;
  check(failed.status === 500 && globalThis.__AUTH.has("u1") && !globalThis.__LOG.includes("auth"), "Firestore 삭제가 실패하면 500 — Firebase Auth 계정은 남아서 다시 시도할 수 있다", `${failed.status} · ${globalThis.__LOG.join(">")}`);
  globalThis.__FIRESTORE_FAIL = false;
  const retry = await del("u1");
  check(retry.status === 200 && left("u1").length === 0 && !globalThis.__AUTH.has("u1"), "다시 시도하면 남은 것이 모두 지워진다 (Supabase는 이미 지워졌어도 터지지 않는다)");
}

/* ── 4. 인증 · 중복 ───────────────────────────────────────────── */
{
  reset();
  const noAuth = await del("u1", false);
  check(noAuth.status === 401 && globalThis.__LOG.length === 0 && globalThis.__FS.size === 30, "토큰이 없으면 401 · 아무것도 지우지 않는다");
  await del("u1");
  const again = await del("u1");
  check(again.status === 200 && left("u1").length === 0, "이미 지운 계정을 다시 지워도 터지지 않는다");
}

if (failures.length) {
  console.error(`\n실패 ${failures.length}건: ${failures.join(" · ")}`);
  process.exit(1);
}
console.log("\nM9 회원 탈퇴 검증을 통과했습니다.");
