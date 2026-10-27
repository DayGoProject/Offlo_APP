/**
 * 알림 계산 (M8) — 서버가 쌓은 알림 문서 읽기 · 정리 · 읽음 처리 · 누르면 갈 화면. 순수 함수만 둔다 (런타임 import 없음) — Node로 검증한다 (scripts/verify-M8-logic.mjs).
 *
 * 알림 문서(`users/{uid}/notifications/{id}`)는 **서버(Admin SDK)만 만든다** — 앱은 읽고(Firestore 실시간 구독), 읽음 표시는 웹 API로 보낸다 (security.md "Firestore는 읽기만").
 * 문서 모양 `{ type, title, body, link?, read, createdAt(ISO) }` — 서버가 준 값이라도 깨진 것이 섞일 수 있어 하나씩 걸러 읽는다.
 *
 * 웹과 다른 점
 *  1. `link`는 **웹 주소**(`/badges` · `/community?post=…`)다 — 앱은 아는 경로만 앱 화면으로 바꾸고(`routeFor`), 모르는 것은 **움직이지 않는다** (외부 주소 · 이상한 값으로 앱을 보내지 않는다).
 *  2. 읽음 표시를 먼저 화면에 반영하고(낙관적), 서버 값이 돌아오기 전의 옛 스냅숏이 다시 "안 읽음"으로 되돌리지 않게 막는다 (`mergeSnapshot`).
 */
import type { NotificationItem, NotificationType } from "@/services/api-types";

/** 서버 `GET /api/notifications`와 같다 — 최근 50건 */
export const NOTIFICATION_LIMIT = 50;

/** 알림 한 줄의 출처 — 실제는 Firestore 구독 + 웹 API, 미리보기는 화면 안 가짜 */
export interface NotificationSource {
  /** 목록을 구독한다 — 바뀔 때마다 `onData`에 최신 목록(최신순)을 준다. 돌려주는 함수를 부르면 구독이 끝난다 */
  subscribe: (onData: (items: NotificationItem[]) => void, onError: (message: string) => void) => () => void;
  markRead: (id: string) => Promise<unknown>;
  markAllRead: () => Promise<unknown>;
}

/* ── 읽기 ──────────────────────────────────────────────────── */

/** 문서 하나를 알림으로 — 제목도 내용도 없거나 문서가 아니면 null (건너뛴다) */
export function normalizeNotification(id: string, raw: unknown): NotificationItem | null {
  if (typeof id !== "string" || id === "" || !raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as Record<string, unknown>;
  const title = typeof d.title === "string" ? d.title.trim() : "";
  const body = typeof d.body === "string" ? d.body.trim() : "";
  if (!title && !body) return null;
  const createdAt = typeof d.createdAt === "string" && !Number.isNaN(new Date(d.createdAt).getTime()) ? d.createdAt : "";
  const link = typeof d.link === "string" && d.link.trim() !== "" ? d.link.trim() : undefined;
  return {
    id,
    type: (typeof d.type === "string" ? d.type : "") as NotificationType,
    title,
    body,
    ...(link ? { link } : {}),
    // 서버도 `read !== true`면 안 읽음으로 센다 (`GET /api/notifications`)
    read: d.read === true,
    createdAt,
  };
}

/** 최신순(같으면 id 큰 쪽 먼저) · 시각을 읽을 수 없는 것은 맨 뒤 · 50건까지 */
export function sortNotifications(items: NotificationItem[]): NotificationItem[] {
  const at = (n: NotificationItem) => (n.createdAt ? new Date(n.createdAt).getTime() : Number.NEGATIVE_INFINITY);
  return [...items].sort((a, b) => at(b) - at(a) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)).slice(0, NOTIFICATION_LIMIT);
}

/* ── 읽음 ──────────────────────────────────────────────────── */

export const unreadCount = (items: readonly NotificationItem[]): number => items.filter((n) => !n.read).length;

export const applyRead = (items: NotificationItem[], id: string): NotificationItem[] =>
  items.map((n) => (n.id === id && !n.read ? { ...n, read: true } : n));

export const applyReadAll = (items: NotificationItem[]): NotificationItem[] => items.map((n) => (n.read ? n : { ...n, read: true }));

/** 읽음 처리가 실패했다 — 그 id들을 다시 안 읽음으로 */
export const revertRead = (items: NotificationItem[], ids: ReadonlySet<string>): NotificationItem[] =>
  items.map((n) => (ids.has(n.id) && n.read ? { ...n, read: false } : n));

/**
 * 새 스냅숏을 화면에 맞춘다. `pending` = "읽음으로 보냈지만 서버 값이 아직 안 돌아온" id들.
 * 옛 스냅숏이 그 사이에 오면 안 읽음으로 보일 수 있어서 pending은 읽음으로 덮는다. 서버가 읽음으로 확인했거나(read) 목록에서 사라졌으면 pending에서 뺀다.
 */
export function mergeSnapshot(
  incoming: NotificationItem[],
  pending: ReadonlySet<string>,
): { items: NotificationItem[]; pending: Set<string> } {
  const next = new Set<string>();
  const items = incoming.map((n) => {
    if (n.read) return n;
    if (pending.has(n.id)) {
      next.add(n.id);
      return { ...n, read: true };
    }
    return n;
  });
  return { items, pending: next };
}

/* ── 표시 ──────────────────────────────────────────────────── */

/** 탭 · 종 아이콘의 숫자 — 없으면 빈 글자, 10개부터 "9+" */
export const badgeLabel = (n: number): string => (n <= 0 ? "" : n > 9 ? "9+" : String(n));

export function notificationsEyebrow(items: readonly NotificationItem[] | null): string {
  if (!items) return "불러오는 중";
  const unread = unreadCount(items);
  if (unread > 0) return `읽지 않은 알림 ${unread}개`;
  return items.length > 0 ? "모두 읽었어요" : "새 소식이 없어요";
}

/* ── 누르면 갈 화면 ─────────────────────────────────────────── */

/** 앱이 열 수 있는 곳 — 서버 알림의 웹 주소를 이 목록 안의 화면으로만 바꾼다 */
export type NotificationTarget = { pathname: "/" | "/badges" | "/garden" | "/goals" | "/analysis" | "/history" | "/community" | "/settings"; params?: { post: string } };

const PATHS: Record<string, NotificationTarget["pathname"]> = {
  "/dashboard": "/",
  "/badges": "/badges",
  "/garden": "/garden",
  "/goals": "/goals",
  "/analysis": "/analysis",
  "/history": "/history",
  "/community": "/community",
  "/settings": "/settings",
};

/** 글 id — 서버 cuid 모양만 (경로 조작 · 이상한 문자를 걸러 낸다) */
const POST_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * 알림의 `link`(웹 주소) → 앱 화면. 아는 경로가 아니면 null — 알림은 읽음 처리만 되고 화면은 움직이지 않는다.
 * `/community?post=<id>`는 그 글을 강조한다 (id가 올바르지 않으면 글 없이 커뮤니티만).
 */
export function routeFor(link: string | null | undefined): NotificationTarget | null {
  if (!link || typeof link !== "string") return null;
  const trimmed = link.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null; // 외부 주소(https://…) · 프로토콜 상대 주소는 열지 않는다
  const [path, query = ""] = trimmed.split("?", 2);
  const pathname = PATHS[path.replace(/\/+$/, "") || "/"];
  if (!pathname) return null;
  if (pathname === "/community") {
    const post = new URLSearchParams(query).get("post");
    if (post && POST_ID.test(post)) return { pathname, params: { post } };
  }
  return { pathname };
}
