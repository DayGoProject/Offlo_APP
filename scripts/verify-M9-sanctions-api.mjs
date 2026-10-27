/**
 * M9 검증 — 웹 **관리자 신고 처리 · 제재**(`lib/moderation-admin.ts` · `lib/sanctions.ts` · `/api/admin/reports` · `/api/admin/sanctions` · 커뮤니티 쓰기 차단 · 가입 차단)를
 * 실제 라우트 코드 그대로 메모리 Firestore · 메모리 DB · 가짜 Firebase Auth에 연결해 돌린다 (Node · 네트워크 불필요).
 *
 *   node scripts/verify-M9-sanctions-api.mjs      (웹 레포가 ../Offlo 에 있어야 한다 — OFFLO_WEB_ROOT로 바꿀 수 있다)
 *
 * 신고 · 숨김은 `verify-M9-moderation-api.mjs`가 본다. 여기서는 그 위의 **관리자 처리**를 본다. 진짜 Firestore · Supabase · Firebase Auth · 배포된 서버는 확인하지 못한다.
 *
 * 확인 항목
 *   1. 관리자만 — 토큰 없음 401 · 관리자가 아니면 404(관리 화면이 있다는 사실도 숨긴다) · `ADMIN_UIDS`에 든 사람만
 *   2. 신고 큐 — 숨겨진 것 · 신고 많은 것 먼저 · 글 원문 · 작성자 · 사유 · 신고자 신원은 내려주지 않는다 · **신고 3명이어도 자동 제재는 없다**
 *   3. 기각 — 큐에서 빠지고 글은 남고 신고는 "기각" · 다시 하면 404 · 제재를 같이 줄 수 없다
 *   4. 삭제 — 글 · 댓글이 지워지고 댓글 수가 맞고 신고는 "조치" · 경고(횟수 + 알림) · 경고만으로는 쓸 수 있다
 *   5. 커뮤니티 정지(7일 · 30일 · 영구) — 글 · 댓글 · 좋아요 403(한국어 + 끝나는 날) · 읽기 · 내 글 삭제 · 신고는 된다 · 기간이 끝나면 풀린다 · 알림
 *   6. 계정 영구 정지 — Firebase Auth 비활성화 + 토큰 무효화 · 글 · 댓글 · 좋아요 정리 + 숫자 보정 · 쓰기 403 · 알림은 안 보냄 · 가입 차단(토큰 이메일 · 본문 이메일 · 대소문자)
 *   7. 탈퇴 후 재가입(새 uid · 같은 이메일)으로도 정지를 피하지 못한다 — 제재 기록은 이메일 해시 키다
 *   8. 제재 목록 · 해제 — 해제하면 Firebase 계정이 다시 열리고 쓰기가 된다 · 경고 횟수는 남는다 · 보관 기간(365일)이 지난 기록은 정리한다
 *   9. 입력 검증 · 처리 기록(moderationLog)
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
process.env.ADMIN_UIDS = "admin1, admin2";

/* ── 가짜 모듈 ───────────────────────────────────────────────── */
const REAL_ADMIN = pathToFileURL(join(WEB_SRC, "lib", "firebase-admin.ts")).href;
const FAKES = {
  "@/lib/firebase-admin": `
    export { apiError, handleApiError } from ${JSON.stringify(REAL_ADMIN)};
    import { apiError } from ${JSON.stringify(REAL_ADMIN)};
    const tick = () => new Promise((r) => setImmediate(r));
    const store = () => globalThis.__FS; // path -> { data, version }
    const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
    const parent = (path) => path.slice(0, path.lastIndexOf("/"));
    const snapOf = (path) => { const cur = store().get(path); return { id: path.slice(path.lastIndexOf("/") + 1), exists: Boolean(cur), data: () => clone(cur?.data), ref: refOf(path) }; };
    const refOf = (path) => ({
      path,
      get: async () => (await tick(), snapOf(path)),
      set: async (data, opts) => { await tick(); const cur = store().get(path); store().set(path, { data: opts?.merge ? { ...(cur?.data ?? {}), ...clone(data) } : clone(data), version: (cur?.version ?? 0) + 1 }); },
      delete: async () => { await tick(); store().delete(path); },
    });
    function query(collectionPath, filters = [], max = Infinity) {
      return {
        where: (field, op, value) => query(collectionPath, [...filters, [field, op, value]], max),
        limit: (n) => query(collectionPath, filters, n),
        get: async () => {
          await tick();
          const docs = [...store().keys()]
            .filter((p) => parent(p) === collectionPath)
            .map(snapOf)
            .filter((d) => filters.every(([f, , v]) => d.data()?.[f] === v))
            .slice(0, max);
          return { docs, empty: docs.length === 0 };
        },
        add: async (data) => { await tick(); const path = collectionPath + "/auto-" + (++globalThis.__SEQ); store().set(path, { data: clone(data), version: 1 }); return refOf(path); },
      };
    }
    const tokenOf = (req) => {
      const h = req.headers.get("Authorization");
      if (!h?.startsWith("Bearer ")) throw apiError("인증이 필요합니다.", 401);
      return h.slice(7); // 가짜: 토큰 = "uid" 또는 "uid|email"
    };
    export async function verifyIdToken(req) { return tokenOf(req).split("|")[0]; }
    export async function verifyIdTokenFull(req) { const [uid, email] = tokenOf(req).split("|"); return { uid, email }; }
    export function getAdminAuth() {
      return {
        updateUser: async (uid, patch) => { await tick(); globalThis.__AUTH.push({ op: "update", uid, ...patch }); if (globalThis.__AUTH_FAIL) throw new Error("auth down"); },
        revokeRefreshTokens: async (uid) => { await tick(); globalThis.__AUTH.push({ op: "revoke", uid }); },
      };
    }
    export function getAdminFirestore() {
      return {
        doc: (path) => refOf(path),
        collection: (path) => query(path),
        batch: () => { const ops = []; return { set: (ref, data, opts) => ops.push(["set", ref, data, opts]), delete: (ref) => ops.push(["delete", ref]), commit: async () => { await tick(); for (const [op, ref, data, opts] of ops) { if (op === "delete") store().delete(ref.path); else { const cur = store().get(ref.path); store().set(ref.path, { data: opts?.merge ? { ...(cur?.data ?? {}), ...clone(data) } : clone(data), version: (cur?.version ?? 0) + 1 }); } } } }; },
        // 실제 Firestore 트랜잭션처럼 — 읽은 문서가 그 사이 바뀌었으면 처음부터 다시 돈다
        runTransaction: async (fn) => {
          for (let attempt = 0; attempt < 50; attempt++) {
            const reads = new Map();
            const writes = [];
            const tx = {
              get: async (ref) => { await tick(); reads.set(ref.path, store().get(ref.path)?.version ?? 0); return snapOf(ref.path); },
              set: (ref, data, opts) => writes.push({ path: ref.path, data: clone(data), merge: Boolean(opts?.merge) }),
            };
            const result = await fn(tx);
            await tick();
            if ([...reads].some(([p, v]) => (store().get(p)?.version ?? 0) !== v)) continue;
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
    const db = () => globalThis.__DB;
    const userOf = (id) => db().users.find((u) => u.id === id);
    const pick = (o, select) => {
      if (!o) return null;
      if (!select) return { ...o };
      const out = {};
      for (const k of Object.keys(select)) {
        if (select[k] === true) out[k] = o[k];
        else if (k === "user") out[k] = pick(userOf(o.userId), select[k].select);
      }
      return out;
    };
    const match = (value, cond) => {
      if (cond && typeof cond === "object" && !(cond instanceof Date)) {
        if ("notIn" in cond) return !cond.notIn.includes(value);
        if ("in" in cond) return cond.in.includes(value);
      }
      return value === cond;
    };
    const test = (row, where) => Object.entries(where ?? {}).every(([k, cond]) => (k === "OR" ? cond.some((w) => test(row, w)) : match(row[k], cond)));
    const fresh = (p) => p + (++globalThis.__SEQ);
    const cascadePost = (ids) => { db().comments = db().comments.filter((c) => !ids.includes(c.postId)); db().likes = db().likes.filter((l) => !ids.includes(l.postId)); };
    const apply = (row, data) => { for (const [k, v] of Object.entries(data)) row[k] = v && typeof v === "object" && "increment" in v ? row[k] + v.increment : v && typeof v === "object" && "decrement" in v ? row[k] - v.decrement : v; };
    const iso = () => new Date().toISOString();
    export const prisma = {
      $transaction: async (fn) => fn(prisma),
      user: {
        findUnique: async ({ where, select }) => (await tick(), pick(db().users.find((u) => (where.uid ? u.uid === where.uid : u.id === where.id)), select)),
        findMany: async ({ where, select }) => (await tick(), db().users.filter((u) => test(u, where)).map((u) => pick(u, select))),
        upsert: async ({ where, create, select }) => { await tick(); let u = db().users.find((x) => x.uid === where.uid); if (!u) { u = { id: fresh("id-n"), premium: false, createdAt: iso(), ...create }; db().users.push(u); } return pick(u, select); },
      },
      post: {
        findUnique: async ({ where, select }) => (await tick(), pick(db().posts.find((p) => p.id === where.id), select)),
        findMany: async ({ where, take, select }) => {
          await tick();
          const rows = db().posts.filter((p) => test(p, where)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
          if (take === undefined) return rows.map((p) => pick(p, select)); // 관리자 조회 (take 없음)
          return rows.slice(0, take).map((p) => ({ ...p, user: { name: userOf(p.userId).name }, likes: [] })); // 피드
        },
        create: async ({ data }) => { await tick(); const p = { id: fresh("p-new-"), type: "text", badgeName: null, likeCount: 0, commentCount: 0, createdAt: iso(), ...data }; db().posts.push(p); return { ...p }; },
        update: async ({ where, data, select }) => { await tick(); const p = db().posts.find((x) => x.id === where.id); apply(p, data); return pick(p, select); },
        updateMany: async ({ where, data }) => { await tick(); const rows = db().posts.filter((p) => test(p, where)); rows.forEach((p) => apply(p, data)); return { count: rows.length }; },
        delete: async ({ where }) => { await tick(); db().posts = db().posts.filter((p) => p.id !== where.id); cascadePost([where.id]); },
        deleteMany: async ({ where }) => { await tick(); const ids = db().posts.filter((p) => test(p, where)).map((p) => p.id); db().posts = db().posts.filter((p) => !ids.includes(p.id)); cascadePost(ids); return { count: ids.length }; },
      },
      comment: {
        findUnique: async ({ where, select }) => (await tick(), pick(db().comments.find((c) => c.id === where.id), select)),
        findMany: async ({ where, take, select }) => {
          await tick();
          const rows = db().comments.filter((c) => test(c, where)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          if (take === undefined) return rows.map((c) => pick(c, select)); // 관리자 조회 (take 없음)
          return rows.slice(0, take).map((c) => ({ ...c, user: { name: userOf(c.userId).name } }));
        },
        create: async ({ data, select }) => { await tick(); const c = { id: fresh("c-new-"), createdAt: iso(), ...data }; db().comments.push(c); return pick(c, select); },
        delete: async ({ where }) => { await tick(); db().comments = db().comments.filter((c) => c.id !== where.id); },
        deleteMany: async ({ where }) => { await tick(); const before = db().comments.length; db().comments = db().comments.filter((c) => !test(c, where)); return { count: before - db().comments.length }; },
        count: async ({ where }) => (await tick(), db().comments.filter((c) => test(c, where)).length),
      },
      postLike: {
        findUnique: async ({ where }) => (await tick(), db().likes.find((l) => l.postId === where.postId_userId.postId && l.userId === where.postId_userId.userId) ?? null),
        findMany: async ({ where, select }) => (await tick(), db().likes.filter((l) => test(l, where)).map((l) => pick(l, select))),
        create: async ({ data }) => { await tick(); db().likes.push({ id: fresh("l-"), ...data }); },
        delete: async ({ where }) => { await tick(); db().likes = db().likes.filter((l) => l.id !== where.id); },
        deleteMany: async ({ where }) => { await tick(); db().likes = db().likes.filter((l) => !test(l, where)); },
        count: async ({ where }) => (await tick(), db().likes.filter((l) => test(l, where)).length),
      },
      badge: { updateMany: async () => ({ count: 0 }) },
      analysis: { groupBy: async () => (await tick(), []) },
    };`,
  "@/lib/notifications": `
    export async function notifyPostComment() {}
    export async function createNotification(uid, input) { globalThis.__NOTIFS.push({ uid, ...input }); }`,
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

const api = (...parts) => import(pathToFileURL(join(WEB_SRC, "app", "api", ...parts, "route.ts")).href);
const reportsRoute = await api("reports");
const adminReports = await api("admin", "reports");
const adminSanctions = await api("admin", "sanctions");
const postsRoute = await api("posts");
const postOneRoute = await api("posts", "[id]");
const commentsRoute = await api("posts", "[id]", "comments");
const likeRoute = await api("posts", "[id]", "like");
const usersRoute = await api("users");
const sanctions = await import(pathToFileURL(join(WEB_SRC, "lib", "sanctions.ts")).href);

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};

/* ── 도구 ────────────────────────────────────────────────────── */
// 사용자: a(제재 대상 1) · w(제재 대상 2) · d(제재 대상 3) · b c(신고자) · e(관찰자). 이메일은 `<이름>@x.com`
const NAMES = ["a", "b", "c", "d", "e", "w"];
const DAY = 86_400_000;
const T = (n) => `2026-10-27T0${n}:00:00.000Z`;
const reset = () => {
  globalThis.__FS = new Map();
  globalThis.__AUTH = [];
  globalThis.__NOTIFS = [];
  globalThis.__SEQ = 0;
  globalThis.__AUTH_FAIL = false;
  globalThis.__DB = {
    users: NAMES.map((u) => ({ id: `id-${u}`, uid: u, email: `${u}@x.com`, name: `이름-${u}` })),
    posts: [
      { id: "p1", userId: "id-a", type: "text", content: "a의 문제 글", badgeName: null, likeCount: 0, commentCount: 0, createdAt: T(9) },
      { id: "p2", userId: "id-w", type: "text", content: "w의 글 2", badgeName: null, likeCount: 0, commentCount: 0, createdAt: T(8) },
      { id: "p3", userId: "id-a", type: "text", content: "a의 글 3", badgeName: null, likeCount: 0, commentCount: 0, createdAt: T(7) },
      { id: "p4", userId: "id-e", type: "text", content: "e의 글 4", badgeName: null, likeCount: 2, commentCount: 3, createdAt: T(6) },
      { id: "p5", userId: "id-a", type: "text", content: "a의 글 5", badgeName: null, likeCount: 0, commentCount: 0, createdAt: T(5) },
      { id: "p6", userId: "id-a", type: "text", content: "a의 글 6", badgeName: null, likeCount: 0, commentCount: 0, createdAt: T(4) },
      { id: "p7", userId: "id-w", type: "text", content: "w의 글 7", badgeName: null, likeCount: 0, commentCount: 0, createdAt: T(3) },
      { id: "p8", userId: "id-d", type: "text", content: "d의 글 8", badgeName: null, likeCount: 0, commentCount: 0, createdAt: T(2) },
    ],
    comments: [
      { id: "c1", postId: "p4", userId: "id-a", content: "a의 댓글", createdAt: T(1) },
      { id: "c2", postId: "p4", userId: "id-w", content: "w의 댓글", createdAt: T(2) },
      { id: "c3", postId: "p4", userId: "id-e", content: "e의 댓글", createdAt: T(3) },
    ],
    likes: [
      { id: "l1", postId: "p4", userId: "id-a" },
      { id: "l2", postId: "p4", userId: "id-w" },
    ],
  };
};
const call = async (handler, method, token, { url = "http://localhost/api/x", body, params } = {}) => {
  const init = { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } };
  if (body !== undefined) init.body = typeof body === "string" ? body : JSON.stringify(body);
  const res = await handler[method](new Request(url, init), params ? { params: Promise.resolve(params) } : undefined);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};
const ADMIN = "admin1";
const report = (uid, targetType, targetId, reason = "spam", extra = {}) => call(reportsRoute, "POST", uid, { body: { targetType, targetId, reason, ...extra } });
const queue = async () => (await call(adminReports, "GET", ADMIN)).json.items;
const resolveIt = (targetType, targetId, action, sanction, token = ADMIN) => call(adminReports, "POST", token, { body: { targetType, targetId, action, ...(sanction ? { sanction } : {}) } });
const writePost = (uid) => call(postsRoute, "POST", uid, { body: { type: "text", content: "새 글" } });
const writeComment = (uid, postId = "p4") => call(commentsRoute, "POST", uid, { params: { id: postId }, body: { content: "새 댓글" } });
const like = (uid, postId = "p4") => call(likeRoute, "POST", uid, { params: { id: postId } });
const key = (name) => sanctions.emailKey(`${name}@x.com`);
const sanctionOf = (name) => globalThis.__FS.get(`sanctions/${key(name)}`)?.data;
const row = (table, id) => globalThis.__DB[table].find((r) => r.id === id);
const reportDocs = () => [...globalThis.__FS.entries()].filter(([p]) => p.startsWith("reports/")).map(([, v]) => v.data);
const logs = () => [...globalThis.__FS.entries()].filter(([p]) => p.startsWith("moderationLog/")).map(([, v]) => v.data);

/* ── 1. 관리자만 ─────────────────────────────────────────────── */
{
  reset();
  check((await call(adminReports, "GET", null)).status === 401 && (await call(adminSanctions, "GET", null)).status === 401, "토큰이 없으면 401");
  check((await call(adminReports, "GET", "b")).status === 404 && (await call(adminSanctions, "GET", "b")).status === 404, "관리자가 아니면 404 (403이 아니다 — 관리 화면이 있다는 사실도 숨긴다)");
  check((await resolveIt("post", "p1", "dismiss", null, "b")).status === 404 && (await call(adminSanctions, "POST", "b", { body: { action: "lift", emailKey: "x" } })).status === 404, "처리 요청(POST)도 관리자가 아니면 404 — 아무것도 바뀌지 않는다");
  check((await call(adminReports, "GET", ADMIN)).status === 200 && (await call(adminReports, "GET", "admin2")).status === 200, "ADMIN_UIDS에 든 사람(쉼표 · 공백 구분)은 열린다");
  check((await call(adminSanctions, "GET", "")).status === 401, "빈 토큰은 401");
  check(sanctions.emailKey(" A@x.com ") === sanctions.emailKey("a@x.com") && sanctions.emailKey("a@x.com") !== sanctions.emailKey("b@x.com") && sanctions.emailKey("x") === null && sanctions.emailKey(undefined) === null, "이메일 해시 키 — 대소문자 · 공백이 달라도 같고 · 이메일 형식이 아니면 null");
  check(/^[0-9a-f]{64}$/.test(key("a")), "키는 SHA-256 hex다 (이메일 원문이 문서 이름에 남지 않는다)");
}

/* ── 2. 신고 큐 ──────────────────────────────────────────────── */
{
  reset();
  await report("b", "post", "p1", "abuse", { detail: "욕설이 있어요" });
  await report("c", "post", "p1", "abuse");
  await report("d", "post", "p1", "spam");
  await report("b", "comment", "c1", "spam");
  await report("c", "post", "p2", "sexual");
  const items = await queue();
  check(items.length === 3 && items[0].key === "post_p1", "큐 — 3건 · 모두에게 숨겨진(신고 3명) p1이 맨 위", items.map((i) => i.key).join());
  const p1 = items[0];
  check(p1.hidden === true && p1.reportCount === 3 && p1.content === "a의 문제 글" && p1.author.name === "이름-a" && p1.author.email === "a@x.com", "글 원문 · 신고 수 · 작성자(이름 · 이메일)");
  check(p1.reports.length === 3 && p1.reports.some((r) => r.reason === "abuse" && r.detail === "욕설이 있어요") && p1.reports.some((r) => r.reason === "spam" && r.detail === null), "신고 사유 · 신고자가 쓴 내용");
  const comment = items.find((i) => i.key === "comment_c1");
  check(comment?.postId === "p4" && comment.content === "a의 댓글" && comment.hidden === false && comment.reportCount === 1, "댓글 항목 — 달린 글(postId) · 숨김 아님");
  const raw = JSON.stringify(items);
  check(!/reporter|"b"|"c"|"d"/.test(raw.replaceAll("이름-", "")) || !/reporterUid|reporterUserId/.test(raw), "신고자 신원(reporterUid · reporterUserId)은 내려주지 않는다");
  check([...globalThis.__FS.keys()].filter((p) => p.startsWith("sanctions/")).length === 0, "신고 3명으로 숨겨져도 **자동 제재는 없다** — 제재는 사람이 정한다");
  check(p1.author.strikes === 0 && p1.author.banned === false && p1.author.communityUntil === undefined, "작성자 제재 이력 — 아직 없음");
  // 작성자가 글을 스스로 지우면 큐에서 사라진다
  globalThis.__DB.posts = globalThis.__DB.posts.filter((p) => p.id !== "p2");
  check((await queue()).every((i) => i.key !== "post_p2") && !globalThis.__FS.has("moderation/post_p2"), "작성자가 지운 글은 큐에서 치운다 (요약 문서도 정리)");
}

/* ── 3. 기각 ─────────────────────────────────────────────────── */
{
  reset();
  await report("b", "post", "p2", "spam");
  await report("c", "post", "p2", "spam");
  await report("d", "post", "p2", "spam");
  const bad = await resolveIt("post", "p2", "dismiss", { kind: "warn" });
  check(bad.status === 400 && globalThis.__FS.has("moderation/post_p2"), "기각에 제재를 함께 주면 400 — 아무것도 바뀌지 않는다");
  const ok = await resolveIt("post", "p2", "dismiss");
  check(ok.status === 200 && ok.json.deleted === false && row("posts", "p2"), "기각 — 200 · 글은 그대로");
  check(!globalThis.__FS.has("moderation/post_p2") && (await queue()).length === 0, "큐에서 빠지고 요약(숨김)이 풀린다");
  check(reportDocs().every((r) => r.status === "dismissed" && r.resolvedBy === ADMIN), "신고 원본은 \"기각\" · 처리한 관리자 기록");
  check((await resolveIt("post", "p2", "dismiss")).status === 404, "이미 처리한 신고를 다시 기각하면 404");
  check((await call(postsRoute, "GET", "e", { url: "http://localhost/api/posts" })).json.posts.some((p) => p.id === "p2"), "기각한 글은 모두에게 다시 보인다 (숨김 해제)");
  check(logs().some((l) => l.action === "dismiss" && l.targetId === "p2" && l.by === ADMIN), "처리 기록(moderationLog)에 남는다");
  // 기각 후 새로 3명이 신고하면 다시 큐에 올라온다
  await report("e", "post", "p2", "spam");
  check((await queue()).some((i) => i.key === "post_p2" && i.reportCount === 1), "기각 뒤 새 신고(다른 사람)가 오면 새로 센다");
}

/* ── 4. 삭제 · 경고 ──────────────────────────────────────────── */
{
  reset();
  await report("b", "comment", "c1", "abuse");
  const res = await resolveIt("comment", "c1", "delete", { kind: "warn", reason: "abuse" });
  check(res.status === 200 && res.json.deleted === true && res.json.sanction.kind === "warn" && res.json.sanction.strikes === 1, "댓글 삭제 + 경고 — 200 · 경고 1회", JSON.stringify(res.json));
  check(!row("comments", "c1") && row("posts", "p4").commentCount === 2, "댓글이 지워지고 달린 글의 댓글 수가 맞는다 (3 → 2)");
  check(reportDocs().every((r) => r.status === "actioned") && !globalThis.__FS.has("moderation/comment_c1"), "신고는 \"조치\"로 · 큐에서 빠진다");
  check(sanctionOf("a").strikes === 1 && sanctionOf("a").banned === false && sanctionOf("a").community === null, "제재 기록 — 경고 1회 · 정지 아님");
  const n = globalThis.__NOTIFS.find((x) => x.uid === "a");
  check(n?.type === "moderation" && /욕설/.test(n.body) && /삭제/.test(n.body), "작성자에게 인앱 알림 — 사유(욕설 · 혐오 · 괴롭힘) · 삭제 안내", n?.body);
  check((await writePost("a")).status === 201 && (await writeComment("a")).status === 201 && (await like("a")).status === 200, "경고만으로는 이용이 막히지 않는다 (글 · 댓글 · 좋아요)");
  // 글 삭제 — 그 글의 댓글 · 좋아요도 함께 지워진다
  await report("b", "post", "p4", "spam");
  const post = await resolveIt("post", "p4", "delete");
  check(post.status === 200 && post.json.sanction === null && !row("posts", "p4") && globalThis.__DB.comments.every((c) => c.postId !== "p4") && globalThis.__DB.likes.length === 0, "글 삭제 — 제재 없이 삭제만 · 그 글의 댓글 · 좋아요도 함께");
  check((await resolveIt("post", "p4", "delete")).status === 404, "이미 지운 글을 다시 처리하면 404");
}

/* ── 5. 커뮤니티 정지 ────────────────────────────────────────── */
{
  reset();
  await report("b", "post", "p1", "abuse");
  const res = await resolveIt("post", "p1", "delete", { kind: "community", days: 7, reason: "abuse" });
  const s = sanctionOf("a");
  check(res.status === 200 && res.json.sanction.until && Math.abs(Date.parse(res.json.sanction.until) - (Date.now() + 7 * DAY)) < 60_000 && s.community.until === res.json.sanction.until, "7일 정지 — 끝나는 시각이 지금 + 7일", res.json.sanction?.until);
  const w = await writePost("a");
  check(w.status === 403 && /커뮤니티 이용이 정지된 계정입니다\./.test(w.json.error) && /\d+년 \d+월 \d+일까지/.test(w.json.error) && /문의/.test(w.json.error), "글쓰기 403 — 한국어 안내 + 끝나는 날 + 문의 안내", w.json.error);
  check((await writeComment("a")).status === 403 && (await like("a", "p3")).status === 403, "댓글 · 좋아요도 403");
  check((await call(postsRoute, "GET", "a", { url: "http://localhost/api/posts" })).status === 200, "읽기는 정지 중에도 된다 (피드)");
  check((await call(postOneRoute, "DELETE", "a", { params: { id: "p3" } })).status === 200 && !row("posts", "p3"), "내 글 삭제는 정지 중에도 된다");
  check((await report("a", "post", "p2")).status === 201, "신고는 정지 중에도 된다");
  check((await writePost("b")).status === 201, "다른 사람은 영향이 없다");
  const n = globalThis.__NOTIFS.find((x) => x.uid === "a");
  check(n?.type === "moderation" && /7일 동안 커뮤니티 이용이 정지/.test(n.body), "작성자에게 알림 — \"7일 동안 커뮤니티 이용이 정지됐어요\"", n?.body);
  // 기간이 끝나면 풀린다 (문서는 이력으로 남는다)
  globalThis.__FS.get(`sanctions/${key("a")}`).data.community.until = new Date(Date.now() - 1000).toISOString();
  check((await writePost("a")).status === 201 && sanctionOf("a").strikes === 1, "기간이 지나면 다시 쓸 수 있다 · 경고 이력은 남는다");
  // 30일 · 영구
  await report("b", "post", "p8", "sexual");
  const d30 = await resolveIt("post", "p8", "delete", { kind: "community", days: 30, reason: "sexual" });
  check(Math.abs(Date.parse(d30.json.sanction.until) - (Date.now() + 30 * DAY)) < 60_000 && (await writePost("d")).status === 403, "30일 정지");
  await report("b", "post", "p5", "abuse");
  const perm = await resolveIt("post", "p5", "delete", { kind: "community", days: null, reason: "abuse" });
  const pw = await writePost("a");
  check(perm.json.sanction.until === null && sanctionOf("a").community.until === null && sanctionOf("a").strikes === 2, "영구 정지 — until null · 경고 이력은 누적(2회)");
  check(pw.status === 403 && !/까지/.test(pw.json.error) && /정지된 계정/.test(pw.json.error), "영구 정지 안내에는 \"~까지\"가 없다", pw.json.error);
  check(globalThis.__AUTH.length === 0, "커뮤니티 정지는 Firebase 계정을 건드리지 않는다 (분석 · 정원은 계속 쓴다)");
}

/* ── 6. 계정 영구 정지 ───────────────────────────────────────── */
{
  reset();
  await report("b", "post", "p7", "sexual");
  const res = await resolveIt("post", "p7", "delete", { kind: "ban", reason: "sexual" });
  check(res.status === 200 && res.json.sanction.kind === "ban" && sanctionOf("w").banned === true && sanctionOf("w").bannedAt, "영구 정지 — 200 · 제재 기록(banned)");
  check(globalThis.__AUTH.some((a) => a.op === "update" && a.uid === "w" && a.disabled === true) && globalThis.__AUTH.some((a) => a.op === "revoke" && a.uid === "w"), "Firebase Auth — 계정 비활성화 + 로그인 토큰 무효화", JSON.stringify(globalThis.__AUTH));
  check(globalThis.__DB.posts.every((p) => p.userId !== "id-w") && globalThis.__DB.comments.every((c) => c.userId !== "id-w") && globalThis.__DB.likes.every((l) => l.userId !== "id-w"), "그 사람의 글 · 댓글 · 좋아요가 모두 정리된다");
  check(row("posts", "p4").commentCount === 2 && row("posts", "p4").likeCount === 1, "남의 글의 댓글 수 · 좋아요 수가 맞게 보정된다 (3 → 2 · 2 → 1)", `${row("posts", "p4").commentCount}/${row("posts", "p4").likeCount}`);
  check(!globalThis.__NOTIFS.some((n) => n.uid === "w"), "정지된 계정에는 알림을 보내지 않는다 (로그인할 수 없다)");
  const w = await writePost("w");
  check(w.status === 403 && /^이용이 정지된 계정입니다\./.test(w.json.error), "토큰이 남아 있어도 커뮤니티 쓰기는 403", w.json.error);
  // 가입 차단
  const signup = (token, email) => call(usersRoute, "POST", token, { body: { email, name: "새 사용자" } });
  check((await signup("w-new|w@x.com", "w@x.com")).status === 403, "정지된 이메일로는 새 계정을 만들 수 없다 (403)");
  check((await signup("w-new|w@x.com", "other@x.com")).status === 403, "본문 이메일을 바꿔도 **토큰 이메일**이 정지면 403");
  check((await signup("fresh|fresh@x.com", " W@X.com ")).status === 403, "본문 이메일의 대소문자 · 공백을 바꿔도 403");
  check(!globalThis.__DB.users.some((u) => u.uid === "w-new" || u.uid === "fresh"), "차단된 가입은 사용자 행을 만들지 않는다");
  check((await signup("fresh|fresh@x.com", "fresh@x.com")).status === 201 && globalThis.__DB.users.some((u) => u.uid === "fresh"), "정지와 무관한 이메일은 그대로 가입된다");
  // Firebase 호출이 실패해도 제재 기록은 이미 남아 있다 (다시 시도할 수 있다)
  reset();
  await report("b", "post", "p7", "sexual");
  globalThis.__AUTH_FAIL = true;
  const failed = await resolveIt("post", "p7", "delete", { kind: "ban", reason: "sexual" });
  check(failed.status >= 500 && sanctionOf("w")?.banned === true && (await writePost("w")).status === 403, "Firebase 호출이 실패하면 오류를 주지만 제재 기록은 이미 남아 커뮤니티 · 가입은 막힌다", String(failed.status));
}

/* ── 7. 탈퇴 후 재가입으로 피하지 못한다 ─────────────────────── */
{
  reset();
  await report("b", "post", "p5", "abuse");
  await resolveIt("post", "p5", "delete", { kind: "community", days: null, reason: "abuse" });
  // 탈퇴(사용자 행 삭제) → 같은 Google 계정으로 다시 가입(새 uid · 같은 이메일)
  globalThis.__DB.users = globalThis.__DB.users.filter((u) => u.id !== "id-a");
  await call(usersRoute, "POST", "a-new|a@x.com", { body: { email: "a@x.com", name: "다시 가입" } });
  const again = await writePost("a-new");
  check(again.status === 403 && /커뮤니티 이용이 정지된 계정/.test(again.json.error), "탈퇴 후 새 uid로 다시 가입해도 커뮤니티 정지가 이어진다 (제재 기록 키 = 이메일 해시)", again.json?.error);
  check(sanctionOf("a").strikes === 1, "제재 기록은 탈퇴로 지워지지 않는다");
}

/* ── 8. 제재 목록 · 해제 · 보관 기간 ─────────────────────────── */
{
  reset();
  await report("b", "post", "p7", "sexual");
  await resolveIt("post", "p7", "delete", { kind: "ban", reason: "sexual" });
  await report("b", "post", "p8", "abuse");
  await resolveIt("post", "p8", "delete", { kind: "community", days: 30, reason: "abuse" });
  await report("b", "post", "p1", "spam");
  await resolveIt("post", "p1", "delete", { kind: "warn", reason: "spam" });
  let list = (await call(adminSanctions, "GET", ADMIN)).json.sanctions;
  check(list.length === 2 && list.some((s) => s.banned && s.user?.name === "이름-w" && s.user.email === "w@x.com") && list.some((s) => !s.banned && s.communityUntil && s.user?.name === "이름-d"), "제재 목록 — 영구 정지(w) · 커뮤니티 정지(d)만 · 경고만 받은 a는 없다", list.map((s) => s.user?.name).join());
  const lifted = await call(adminSanctions, "POST", ADMIN, { body: { action: "lift", emailKey: key("w") } });
  check(lifted.status === 200 && sanctionOf("w").banned === false && sanctionOf("w").strikes === 1, "해제 — 계정 영구 정지가 풀리고 경고 이력(1회)은 남는다");
  check(globalThis.__AUTH.some((a) => a.op === "update" && a.uid === "w" && a.disabled === false), "정지했던 Firebase 계정이 다시 열린다");
  check((await writePost("w")).status === 201, "해제하면 다시 쓸 수 있다");
  check((await call(adminSanctions, "POST", ADMIN, { body: { action: "lift", emailKey: key("w") } })).status === 404, "이미 푼 제재를 다시 풀면 404");
  check((await call(adminSanctions, "POST", ADMIN, { body: { action: "lift", emailKey: "not-a-hash" } })).status === 400 && (await call(adminSanctions, "POST", ADMIN, { body: { action: "ban", emailKey: key("w") } })).status === 400, "해제 요청 검증 — 해시가 아니면 400 · 모르는 작업 400");
  await call(adminSanctions, "POST", ADMIN, { body: { action: "lift", emailKey: key("d") } });
  check((await writePost("d")).status === 201 && logs().filter((l) => l.action === "lift").length === 2, "커뮤니티 정지도 풀린다 · 해제 2건이 처리 기록에 남는다");
  list = (await call(adminSanctions, "GET", ADMIN)).json.sanctions;
  check(list.length === 0, "다 풀면 목록이 빈다");
  // 보관 기간 정리 — 끝난 기록이 365일을 넘으면 지운다
  const old = new Date(Date.now() - 400 * DAY).toISOString();
  globalThis.__FS.set("sanctions/" + "0".repeat(64), { data: { emailKey: "0".repeat(64), userId: null, strikes: 2, community: null, banned: false, bannedAt: null, updatedAt: old }, version: 1 });
  globalThis.__FS.set("moderationLog/old-1", { data: { action: "warn", createdAt: old }, version: 1 });
  const activeOld = "1".repeat(64);
  globalThis.__FS.set("sanctions/" + activeOld, { data: { emailKey: activeOld, userId: null, strikes: 1, community: null, banned: true, bannedAt: old, updatedAt: old }, version: 1 });
  list = (await call(adminSanctions, "GET", ADMIN)).json.sanctions;
  check(!globalThis.__FS.has("sanctions/" + "0".repeat(64)) && !globalThis.__FS.has("moderationLog/old-1"), "보관 기간(365일)이 지난 끝난 제재 · 처리 기록은 정리된다");
  check(globalThis.__FS.has("sanctions/" + activeOld) && list.some((s) => s.emailKey === activeOld && s.user === null), "**계속 중인 영구 정지는 오래돼도 남는다** · 탈퇴한 계정은 user null로 보인다");
}

/* ── 9. 입력 검증 ────────────────────────────────────────────── */
{
  reset();
  await report("b", "post", "p1", "spam");
  const bad = async (body) => (await call(adminReports, "POST", ADMIN, { body })).status;
  check((await bad({ targetType: "post", targetId: "p1", action: "ban" })) === 400 && (await bad({ targetType: "user", targetId: "p1", action: "delete" })) === 400 && (await bad({ action: "delete" })) === 400, "처리 방법 · 대상이 틀리면 400");
  check((await bad({ targetType: "post", targetId: "p1", action: "delete", sanction: { kind: "freeze" } })) === 400, "제재 종류가 틀리면 400");
  check((await bad({ targetType: "post", targetId: "p1", action: "delete", sanction: { kind: "community" } })) === 400 && (await bad({ targetType: "post", targetId: "p1", action: "delete", sanction: { kind: "community", days: 5 } })) === 400, "커뮤니티 정지는 기간(7 · 30 · null)이 꼭 필요하다");
  check((await bad({ targetType: "post", targetId: "p1", action: "delete", sanction: { kind: "warn", reason: "없는사유" } })) === 400, "제재 사유가 목록에 없으면 400");
  check((await call(adminReports, "POST", ADMIN, { body: "JSON 아님" })).status === 400, "본문이 JSON이 아니면 400");
  check(row("posts", "p1") && globalThis.__FS.has("moderation/post_p1") && !globalThis.__FS.has(`sanctions/${key("a")}`), "검증에 걸린 요청은 아무것도 바꾸지 않는다");
  check((await resolveIt("post", "없는글", "delete")).status === 404 && (await resolveIt("comment", "없는댓글", "dismiss")).status === 404, "없는 글 · 이미 처리된 신고는 404");
  // 글이 이미 없어도(작성자가 지웠다) 신고 요약이 남아 있으면 제재는 줄 수 있다
  globalThis.__DB.posts = globalThis.__DB.posts.filter((p) => p.id !== "p1");
  const gone = await resolveIt("post", "p1", "delete", { kind: "warn", reason: "spam" });
  check(gone.status === 200 && gone.json.deleted === false && gone.json.sanction.kind === "warn" && sanctionOf("a").strikes === 1, "작성자가 글을 먼저 지웠어도 신고 요약의 작성자에게 제재를 줄 수 있다");
  check(logs().length >= 1 && logs().every((l) => l.by === ADMIN && l.createdAt), "모든 처리가 관리자 · 시각과 함께 moderationLog에 남는다");
}

if (failures.length) {
  console.error(`\n실패 ${failures.length}건: ${failures.join(" · ")}`);
  process.exit(1);
}
console.log("\nM9 제재 API 검증을 통과했습니다.");
