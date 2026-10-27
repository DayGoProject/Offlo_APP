/**
 * M9 검증 — 웹 **커뮤니티 신고 · 차단**(`lib/moderation.ts` · `/api/reports` · `/api/blocks` · 피드 · 댓글 · 랭킹 필터)을 실제 라우트 코드 그대로 메모리 Firestore · 메모리 DB에 연결해 돌린다 (Node · 네트워크 불필요).
 *
 *   node scripts/verify-M9-moderation-api.mjs      (웹 레포가 ../Offlo 에 있어야 한다 — OFFLO_WEB_ROOT로 바꿀 수 있다)
 *
 * 배경: Google Play는 사용자 생성 콘텐츠(UGC)가 있는 앱에 글 · 댓글 · 사용자 신고와 사용자 차단을 요구한다. 서버가 신고를 받아 쌓고, 신고 · 차단한 것을 그 사람의 피드에서 빼고,
 * 서로 다른 신고자 3명이 모이면 모두에게서 숨겨야 한다. `@/lib/firebase-admin`(토큰 검증 · Firestore — **읽은 문서가 바뀌면 트랜잭션이 다시 돈다**) · `@/lib/prisma`(메모리 표) ·
 * `@/lib/notifications`(무시)를 바꿔 끼운다. **진짜 Firestore · Supabase · 배포된 서버는 확인하지 못한다.**
 *
 * 확인 항목
 *   1. 신고 입력 검증 — 인증 · 사유 · 대상 종류/ID · 없는 글/댓글 404 · 내 글 신고 불가 · 내용 길이
 *   2. 신고하면 그 사람에게는 곧바로 숨겨지고(글 · 댓글) 다른 사람에게는 그대로 보인다 · 같은 대상을 다시 신고해도 한 건(멱등)
 *   3. 서로 다른 신고자 3명이면 모두에게서 숨겨진다 (작성자 본인에게는 보인다) · 같은 사람의 중복 신고는 세지 않는다 · 동시에 와도 정확히 센다
 *   4. 하루 상한 30건 (KST 날짜 경계로 새로 센다)
 *   5. 차단 — 글/댓글로 작성자를 가리켜 차단 · 나 자신 불가 · 멱등 · 차단하면 그 사람의 글 · 댓글 · 랭킹이 내게서 빠진다 · 목록 · 해제
 *   6. 피드가 필터를 쿼리 단계에서 걸어 페이지가 비지 않고 커서가 이어진다
 *   7. 탈퇴 — 그 사람이 한 신고 원본만 지우고 다른 사람의 신고 · 요약은 남긴다
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
    const tick = () => new Promise((r) => setImmediate(r));
    const store = () => globalThis.__FS; // path -> { data, version }
    const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
    const parent = (path) => path.slice(0, path.lastIndexOf("/"));
    const snapOf = (path) => { const cur = store().get(path); return { id: path.slice(path.lastIndexOf("/") + 1), exists: Boolean(cur), data: () => clone(cur?.data), ref: { path } }; };
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
      };
    }
    export async function verifyIdToken(req) {
      const h = req.headers.get("Authorization");
      if (!h?.startsWith("Bearer ")) throw apiError("인증이 필요합니다.", 401);
      return h.slice(7); // 가짜: 토큰 = uid
    }
    export function getAdminFirestore() {
      return {
        doc: (path) => ({ path, delete: async () => { await tick(); store().delete(path); }, get: async () => snapOf(path) }),
        collection: (path) => query(path),
        batch: () => { const ops = []; return { delete: (ref) => ops.push(ref.path), commit: async () => { await tick(); for (const p of ops) store().delete(p); } }; },
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
            if ([...reads].some(([p, v]) => (store().get(p)?.version ?? 0) !== v)) { globalThis.__RETRIES++; continue; }
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
    const pick = (o, select) => (!o ? null : !select ? { ...o } : Object.fromEntries(Object.keys(select).filter((k) => select[k] === true).map((k) => [k, o[k]])));
    // where 한 칸 — 같다 · { in } · { notIn }
    const match = (value, cond) => {
      if (cond && typeof cond === "object" && !(cond instanceof Date)) {
        if ("notIn" in cond) return !cond.notIn.includes(value);
        if ("in" in cond) return cond.in.includes(value);
      }
      return value === cond;
    };
    const test = (row, where) => Object.entries(where ?? {}).every(([k, cond]) => (k === "OR" ? cond.some((w) => test(row, w)) : match(row[k], cond)));
    const userOf = (id) => db().users.find((u) => u.id === id);
    export const prisma = {
      user: {
        findUnique: async ({ where, select }) => (await tick(), pick(db().users.find((u) => (where.uid ? u.uid === where.uid : u.id === where.id)), select)),
        findMany: async ({ where, select }) => (await tick(), db().users.filter((u) => test(u, where)).map((u) => pick(u, select))),
      },
      post: {
        findUnique: async ({ where, select }) => (await tick(), pick(db().posts.find((p) => p.id === where.id), select)),
        findMany: async ({ where, take, cursor, skip = 0 }) => {
          await tick();
          const sorted = db().posts.filter((p) => test(p, where)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
          const start = cursor ? sorted.findIndex((p) => p.id === cursor.id) + skip : 0;
          return sorted.slice(start, start + take).map((p) => ({ ...p, user: { name: userOf(p.userId).name }, likes: [] }));
        },
      },
      comment: {
        findUnique: async ({ where, select }) => (await tick(), pick(db().comments.find((c) => c.id === where.id), select)),
        findMany: async ({ where, take }) => {
          await tick();
          return db().comments.filter((c) => test(c, where)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, take).map((c) => ({ ...c, user: { name: userOf(c.userId).name } }));
        },
      },
      analysis: { groupBy: async () => (await tick(), db().ranking) },
    };`,
  "@/lib/notifications": `export async function notifyPostComment() {}`,
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
const blocksRoute = await api("blocks");
const blockOneRoute = await api("blocks", "[userId]");
const postsRoute = await api("posts");
const commentsRoute = await api("posts", "[id]", "comments");
const rankingRoute = await api("ranking");
const moderation = await import(pathToFileURL(join(WEB_SRC, "lib", "moderation.ts")).href);

const failures = [];
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(label);
};

/* ── 도구 ────────────────────────────────────────────────────── */
// 사용자: a(글쓴이) · b · c · d · e(관찰자) · w(작성자2)
const USERS = ["a", "b", "c", "d", "e", "w"];
const reset = () => {
  globalThis.__FS = new Map();
  globalThis.__RETRIES = 0;
  const T = (n) => `2026-10-27T0${n}:00:00.000Z`;
  globalThis.__DB = {
    users: USERS.map((u) => ({ id: `id-${u}`, uid: u, name: `이름-${u}` })),
    posts: [
      { id: "p1", userId: "id-a", type: "text", content: "a의 글 1", badgeName: null, likeCount: 0, commentCount: 0, createdAt: T(9) },
      { id: "p2", userId: "id-w", type: "text", content: "w의 글 2", badgeName: null, likeCount: 0, commentCount: 0, createdAt: T(8) },
      { id: "p3", userId: "id-a", type: "text", content: "a의 글 3", badgeName: null, likeCount: 0, commentCount: 0, createdAt: T(7) },
      { id: "p4", userId: "id-b", type: "text", content: "b의 글 4", badgeName: null, likeCount: 0, commentCount: 0, createdAt: T(6) },
      { id: "p5", userId: "id-a", type: "text", content: "a의 글 5", badgeName: null, likeCount: 0, commentCount: 0, createdAt: T(5) },
    ],
    comments: [
      { id: "c1", postId: "p4", userId: "id-a", content: "a의 댓글", createdAt: T(1) },
      { id: "c2", postId: "p4", userId: "id-w", content: "w의 댓글", createdAt: T(2) },
      { id: "c3", postId: "p4", userId: "id-e", content: "e의 댓글", createdAt: T(3) },
    ],
    ranking: [
      { userId: "id-a", _avg: { detoxScore: 90 }, _count: { _all: 5 } },
      { userId: "id-w", _avg: { detoxScore: 80 }, _count: { _all: 4 } },
      { userId: "id-e", _avg: { detoxScore: 70 }, _count: { _all: 3 } },
    ],
  };
};
const call = async (handler, method, uid, { url = "http://localhost/api/x", body, params } = {}) => {
  const init = { method, headers: { "Content-Type": "application/json", ...(uid ? { Authorization: `Bearer ${uid}` } : {}) } };
  if (body !== undefined) init.body = typeof body === "string" ? body : JSON.stringify(body);
  const res = await handler[method](new Request(url, init), params ? { params: Promise.resolve(params) } : undefined);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};
const report = (uid, targetType, targetId, reason = "spam", extra = {}) => call(reportsRoute, "POST", uid, { body: { targetType, targetId, reason, ...extra } });
const block = (uid, targetType, targetId) => call(blocksRoute, "POST", uid, { body: { targetType, targetId } });
const feed = async (uid, query = "") => {
  const r = await call(postsRoute, "GET", uid, { url: `http://localhost/api/posts${query}` });
  return { ids: r.json.posts.map((p) => p.id), next: r.json.nextCursor, status: r.status };
};
const comments = async (uid, postId = "p4") => (await call(commentsRoute, "GET", uid, { params: { id: postId } })).json.comments.map((c) => c.id);
const ranking = async (uid) => (await call(rankingRoute, "GET", uid)).json;
const reports = () => [...globalThis.__FS.keys()].filter((p) => p.startsWith("reports/"));
const summary = (type, id) => globalThis.__FS.get(`moderation/${type}_${id}`)?.data;
const silent = async (fn) => {
  const original = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = original;
  }
};

/* ── 1. 신고 입력 검증 ────────────────────────────────────────── */
{
  reset();
  check((await call(reportsRoute, "POST", null, { body: { targetType: "post", targetId: "p1", reason: "spam" } })).status === 401, "토큰이 없으면 401");
  check((await report("b", "post", "p1", "없는사유")).status === 400 && (await report("b", "post", "p1", null)).status === 400, "신고 사유가 없거나 목록에 없으면 400");
  check((await report("b", "user", "p1")).status === 400 && (await call(reportsRoute, "POST", "b", { body: { reason: "spam" } })).status === 400, "대상 종류(post · comment)가 틀리거나 없으면 400");
  check((await report("b", "post", "")).status === 400 && (await report("b", "post", "x".repeat(129))).status === 400, "대상 ID가 비었거나 너무 길면 400");
  const missing = await report("b", "post", "없는글");
  check(missing.status === 404 && /게시글/.test(missing.json.error), "없는 글은 404 + 한국어 안내", missing.json.error);
  check((await report("b", "comment", "없는댓글")).status === 404, "없는 댓글도 404");
  const own = await report("a", "post", "p1");
  check(own.status === 400 && /내가 쓴/.test(own.json.error) && reports().length === 0, "내 글은 신고할 수 없다(400) · 아무것도 쌓이지 않는다", own.json.error);
  check((await report("a", "comment", "c1")).status === 400, "내 댓글도 신고할 수 없다");
  check((await report("b", "post", "p1", "spam", { detail: "가".repeat(301) })).status === 400 && (await report("b", "post", "p1", "spam", { detail: 5 })).status === 400, "신고 내용이 300자를 넘거나 문자열이 아니면 400");
  check((await call(reportsRoute, "POST", "b", { body: "JSON 아님" })).status === 400, "본문이 JSON이 아니면 400");
  check(reports().length === 0, "검증에 걸린 요청은 아무것도 저장하지 않는다");
  const ok = await report("b", "post", "p1", "abuse", { detail: "  욕설이 있어요  " });
  check(ok.status === 201 && ok.json.ok === true && ok.json.alreadyReported === false && ok.json.hidden === false, "정상 신고 — 201 · 새로 쌓임 · 아직 안 숨김", JSON.stringify(ok.json));
  const doc = globalThis.__FS.get("reports/b_post_p1").data;
  check(doc.reason === "abuse" && doc.detail === "욕설이 있어요" && doc.status === "open" && doc.reporterUid === "b" && doc.targetUserId === "id-a", "신고 원본 — 사유 · 다듬은 내용 · open · 신고자 · 대상 작성자");
}

/* ── 2. 신고한 사람에게는 곧바로 숨김 · 멱등 ──────────────────── */
{
  reset();
  await report("b", "post", "p1");
  check(!(await feed("b")).ids.includes("p1") && (await feed("b")).ids.length === 4, "신고한 글은 신고한 사람의 피드에서 곧바로 빠진다");
  check((await feed("c")).ids.includes("p1") && (await feed("a")).ids.includes("p1"), "다른 사람(c) · 작성자(a)에게는 그대로 보인다");
  const again = await report("b", "post", "p1");
  check(again.status === 201 && again.json.alreadyReported === true && summary("post", "p1").reportCount === 1 && reports().length === 1, "같은 대상을 다시 신고해도 한 건이다 (멱등) — 요약 카운트도 1", JSON.stringify(again.json));
  await report("b", "comment", "c1");
  check(!(await comments("b")).includes("c1") && (await comments("c")).includes("c1"), "신고한 댓글도 신고한 사람에게만 빠진다");
}

/* ── 3. 3명이 모이면 모두에게서 숨김 ──────────────────────────── */
{
  reset();
  await report("b", "post", "p1");
  await report("b", "post", "p1"); // 같은 사람의 중복은 세지 않는다
  const second = await report("c", "post", "p1");
  check(second.json.hidden === false && summary("post", "p1").reportCount === 2 && (await feed("d")).ids.includes("p1"), "서로 다른 신고자 2명 — 아직 보인다 (같은 사람의 중복은 세지 않았다)");
  const third = await report("d", "post", "p1");
  check(third.json.hidden === true && summary("post", "p1").hidden === true, "3번째 신고자 — 자동 숨김");
  check(!(await feed("e")).ids.includes("p1") && !(await feed("w")).ids.includes("p1"), "신고하지 않은 다른 사람(e · w)에게도 이제 안 보인다");
  check((await feed("a")).ids.includes("p1"), "작성자 본인에게는 계속 보인다");
  const late = await report("e", "post", "p1");
  check(late.status === 201 && late.json.hidden === true && summary("post", "p1").reportCount === 4, "이미 숨겨진 뒤의 신고도 받는다 (카운트는 계속 쌓인다)");
  // 댓글도 같다
  await report("b", "comment", "c2");
  await report("c", "comment", "c2");
  await report("d", "comment", "c2");
  check(!(await comments("e")).includes("c2") && (await comments("w")).includes("c2"), "댓글도 3명이 모이면 모두에게서 숨고 작성자(w)에게는 보인다");

  // 동시에 와도 정확히 센다 — 서로 다른 신고자 3명이 한꺼번에
  reset();
  const burst = await Promise.all(["b", "c", "d"].map((u) => report(u, "post", "p1")));
  check(burst.every((r) => r.status === 201) && summary("post", "p1").reportCount === 3 && summary("post", "p1").hidden === true, "서로 다른 신고자 3명이 동시에 신고해도 정확히 3 · 숨김 (트랜잭션)", `카운트 ${summary("post", "p1")?.reportCount} · 상태 ${burst.map((r) => r.status)}`);
  check(globalThis.__RETRIES > 0, "동시 요청은 트랜잭션이 실제로 부딪쳐 다시 시도했다 (시험이 경쟁을 만들었다)", `재시도 ${globalThis.__RETRIES}번`);
  // 같은 사람이 동시에 20번 — 한 건
  reset();
  const dup = await Promise.all(Array.from({ length: 20 }, () => report("b", "post", "p1")));
  check(dup.every((r) => r.status === 201) && summary("post", "p1").reportCount === 1 && reports().length === 1, "같은 사람이 20번 동시에 신고해도 한 건 · 카운트 1");
}

/* ── 4. 하루 상한 ────────────────────────────────────────────── */
{
  reset();
  globalThis.__DB.posts = Array.from({ length: 31 }, (_, i) => ({ id: `q${i}`, userId: "id-a", type: "text", content: "x", badgeName: null, likeCount: 0, commentCount: 0, createdAt: `2026-10-27T0${i % 10}:00:00.000Z` }));
  const results = [];
  for (let i = 0; i < 31; i++) results.push((await report("b", "post", `q${i}`)).status);
  check(results.slice(0, 30).every((s) => s === 201) && results[30] === 429, "하루 30건까지는 통과하고 31번째는 429", `${results.filter((s) => s === 201).length}건 통과 · 마지막 ${results[30]}`);
  const dupAfterCap = await report("b", "post", "q0");
  check(dupAfterCap.status === 201 && dupAfterCap.json.alreadyReported === true, "상한 뒤에도 이미 신고한 것을 다시 보내는 것은 막히지 않는다 (멱등)");
  // KST 날짜 경계 — lib 함수에 시각을 직접 준다
  reset();
  globalThis.__DB.posts = Array.from({ length: 31 }, (_, i) => ({ id: `q${i}`, userId: "id-a", type: "text", content: "x", badgeName: null, likeCount: 0, commentCount: 0, createdAt: "2026-10-27T00:00:00.000Z" }));
  const at = (iso) => Date.parse(iso);
  for (let i = 0; i < 30; i++) await moderation.reportContent("b", "id-b", { targetType: "post", targetId: `q${i}`, reason: "spam" }, at("2026-10-27T14:59:00Z")); // KST 10/27 23:59
  let capped = false;
  try {
    await moderation.reportContent("b", "id-b", { targetType: "post", targetId: "q30", reason: "spam" }, at("2026-10-27T14:59:30Z"));
  } catch (e) {
    capped = e.status === 429;
  }
  const nextDay = await moderation.reportContent("b", "id-b", { targetType: "post", targetId: "q30", reason: "spam" }, at("2026-10-27T15:00:00Z")); // KST 10/28 0:00
  check(capped && nextDay.alreadyReported === false, "KST 자정(UTC 15:00)이 지나면 새로 센다 — 23:59에는 429 · 0:00에는 통과");
}

/* ── 5. 차단 ─────────────────────────────────────────────────── */
{
  reset();
  const me = await block("b", "post", "p1");
  check(me.status === 201 && me.json.block.userId === "id-a" && me.json.block.name === "이름-a" && typeof me.json.block.createdAt === "string", "글로 작성자를 차단한다 — 작성자 id · 이름이 돌아온다", JSON.stringify(me.json));
  check((await feed("b")).ids.join() === "p2,p4" && (await feed("c")).ids.length === 5, "차단하면 그 사람(a)의 글 3개가 내 피드에서 빠지고 다른 사람(c)은 그대로다", (await feed("b")).ids.join());
  check(!(await comments("b")).includes("c1") && (await comments("c")).includes("c1"), "차단한 사람의 댓글도 내게서 빠진다 (다른 사람에게는 그대로)");
  const rk = await ranking("b");
  check(!rk.ranking.some((r) => r.name === "이름-a") && rk.ranking[0].rank === 1 && rk.ranking[0].name === "이름-w", "랭킹에서도 빠지고 순위는 남은 사람끼리 다시 센다", JSON.stringify(rk.ranking.map((r) => [r.rank, r.name])));
  const rkOther = await ranking("c");
  check(rkOther.ranking[0].name === "이름-a", "다른 사람의 랭킹은 그대로다");
  const again = await block("b", "post", "p3"); // 같은 작성자(a)의 다른 글로 다시
  check(again.status === 201 && again.json.block.userId === "id-a" && again.json.block.createdAt === me.json.block.createdAt, "같은 사람을 다시 차단해도 그대로다 (멱등 · 차단한 시각이 바뀌지 않는다)");
  const byComment = await block("b", "comment", "c2");
  check(byComment.json.block.userId === "id-w", "댓글로도 작성자를 차단한다");
  const self = await block("a", "post", "p1");
  check(self.status === 400 && /나 자신/.test(self.json.error), "나 자신은 차단할 수 없다 (400)", self.json.error);
  check((await block("b", "post", "없는글")).status === 404 && (await block("b", "post", "")).status === 400 && (await block("b", "x", "p1")).status === 400, "없는 글 404 · 대상 ID/종류 검증 400");
  check((await call(blocksRoute, "POST", null, { body: { targetType: "post", targetId: "p1" } })).status === 401, "토큰이 없으면 401");

  const list = await call(blocksRoute, "GET", "b");
  check(list.status === 200 && list.json.blocks.length === 2 && list.json.blocks.every((x) => x.name.startsWith("이름-") && x.userId.startsWith("id-")), "차단 목록 — 이름과 함께 2명", JSON.stringify(list.json.blocks.map((x) => x.name)));
  check((await call(blocksRoute, "GET", "c")).json.blocks.length === 0, "다른 사람(c)의 차단 목록은 비어 있다 (남의 차단은 안 보인다)");

  const un = await call(blockOneRoute, "DELETE", "b", { params: { userId: "id-a" } });
  check(un.status === 204 && (await feed("b")).ids.includes("p1") && (await comments("b")).includes("c1"), "차단을 풀면(204) 그 사람의 글 · 댓글이 다시 보인다");
  check((await call(blockOneRoute, "DELETE", "b", { params: { userId: "id-a" } })).status === 204, "이미 푼 차단을 다시 풀어도 성공한다 (멱등)");
  check((await call(blocksRoute, "GET", "b")).json.blocks.length === 1, "목록에서 빠진다 (1명 남음)");
  check((await call(blockOneRoute, "DELETE", null, { params: { userId: "id-a" } })).status === 401, "해제도 토큰이 없으면 401");
}

/* ── 6. 페이지가 비지 않는다 ──────────────────────────────────── */
{
  reset();
  await block("b", "post", "p1"); // a의 글 p1 · p3 · p5를 뺀다
  await report("b", "post", "p2");
  const p1 = await feed("b", "?limit=1");
  check(p1.ids.join() === "p4" && p1.next === null, "필터가 쿼리에서 걸려 limit=1이어도 남은 글(p4) 한 개로 끝난다 — 빈 페이지가 나오지 않는다", `${p1.ids} / ${p1.next}`);
  reset();
  await block("d", "post", "p1"); // a의 글 3개 제외 → 남는 글 p2 · p4 (2개)
  const page1 = await feed("d", "?limit=1");
  const page2 = await feed("d", `?limit=1&cursor=${page1.next}`);
  check(page1.ids.join() === "p2" && page1.next === "p2" && page2.ids.join() === "p4" && page2.next === null, "페이지를 넘겨도 차단한 글을 건너뛰며 커서가 이어진다 (p2 → p4 → 끝)", `${page1.ids}→${page2.ids}`);
}

/* ── 7. 탈퇴 ─────────────────────────────────────────────────── */
{
  reset();
  await report("b", "post", "p1");
  await report("b", "post", "p3");
  await report("c", "post", "p1");
  check(reports().length === 3, "신고 3건이 쌓였다 (b 2건 · c 1건)");
  await moderation.deleteReportsBy("b");
  check(reports().join() === "reports/c_post_p1" && summary("post", "p1").reportCount === 2, "b가 탈퇴하면 b의 신고 원본만 지운다 — c의 신고와 대상별 요약은 남는다");
  await moderation.deleteReportsBy("b"); // 이미 비어 있어도 터지지 않는다
  await moderation.deleteReportsBy("nobody");
  check(reports().length === 1, "지울 것이 없어도 터지지 않는다");
  // 400건이 넘어도 지운다 (한 번에 400개씩)
  reset();
  for (let i = 0; i < 450; i++) globalThis.__FS.set(`reports/x_post_${i}`, { data: { reporterUid: "x" }, version: 1 });
  globalThis.__FS.set("reports/y_post_1", { data: { reporterUid: "y" }, version: 1 });
  await moderation.deleteReportsBy("x");
  check(reports().length === 1 && reports()[0] === "reports/y_post_1", "신고가 450건이어도 여러 번에 나눠 모두 지운다 (다른 사람 것은 남긴다)");
}

if (failures.length) {
  console.error(`\n실패 ${failures.length}건: ${failures.join(" · ")}`);
  process.exit(1);
}
console.log("\nM9 신고 · 차단 검증을 통과했습니다.");
