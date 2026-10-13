/**
 * 커뮤니티 계산 (M7 7-3) — 피드 목록 갱신 · 좋아요 낙관적 계산 · 입력 검증 · 상대 시간 · 랭킹 표시. 순수 함수만 둔다
 * (런타임 import는 `@/shared/*` 뿐) — Node로 검증한다 (scripts/verify-M7-logic.mjs).
 *
 * 규칙의 원본은 웹 서버다 (`web/src/lib/social.ts`): 글 1000자 · 댓글 300자 · 피드 10개씩 커서 페이지 · 좋아요는 글당 1인 1회 토글.
 * 화면은 낙관적으로 먼저 바꾸고 **서버 응답이 진실**이다 (좋아요 수는 서버가 돌려준 값으로 덮어쓴다).
 *
 * 웹과 다른 점
 *  1. 상대 시간을 기준 시각을 받아 계산한다 (웹 `relTime`은 `Date.now()`를 직접 읽어 미리보기 스크린샷이 날마다 달라진다). 7일이 넘으면 날짜는 **KST**다.
 *  2. 피드에 글이 더해질 때 id로 중복을 걸러 낸다 (페이지를 읽는 사이에 글이 올라와 커서가 밀리면 같은 글이 두 번 올 수 있다).
 */
import type { FeedComment, FeedPost, RankingEntry } from "@/services/api-types";
import { kstDateKey } from "@/shared/kst";

/** 서버 `MAX_POST_LENGTH` · `MAX_COMMENT_LENGTH` — 앱도 같은 값으로 입력을 막는다 */
export const POST_MAX = 1000;
export const COMMENT_MAX = 300;
/** 커뮤니티 이름 공개 안내를 닫았는지 저장하는 키 (웹 localStorage 키와 같은 이름) */
export const NOTICE_KEY = "offlo_community_notice_dismissed";

/* ── 피드 목록 ─────────────────────────────────────────────── */

/** 다음 페이지를 이어 붙인다 — 이미 있는 id는 건너뛴다 */
export function appendPage(current: FeedPost[], page: FeedPost[]): FeedPost[] {
  const seen = new Set(current.map((p) => p.id));
  return [...current, ...page.filter((p) => !seen.has(p.id))];
}

export function patchPost(posts: FeedPost[], id: string, patch: Partial<FeedPost>): FeedPost[] {
  return posts.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

export function removePost(posts: FeedPost[], id: string): FeedPost[] {
  return posts.filter((p) => p.id !== id);
}

/** 알림 링크(`?post=id`)로 강조할 글의 자리 — 첫 페이지에 없으면 -1 (수용된 한계: 강조하지 않는다) */
export function indexOfPost(posts: FeedPost[], id: string | null | undefined): number {
  return id ? posts.findIndex((p) => p.id === id) : -1;
}

/* ── 좋아요 · 댓글 수 ───────────────────────────────────────── */

/** 누르는 순간 화면에 먼저 보일 값 — 서버 응답이 오면 그 값으로 덮어쓴다 */
export function likeOptimistic(post: Pick<FeedPost, "liked" | "likeCount">): { liked: boolean; likeCount: number } {
  return { liked: !post.liked, likeCount: Math.max(0, post.likeCount + (post.liked ? -1 : 1)) };
}

/** 댓글을 달거나 지웠을 때 글의 댓글 수 */
export function commentCountAfter(count: number, delta: 1 | -1): number {
  return Math.max(0, count + delta);
}

/* ── 입력 ──────────────────────────────────────────────────── */

export type TextCheck = { ok: true; text: string } | { ok: false; error: string; empty: boolean };

function checkText(raw: string, max: number, label: string): TextCheck {
  const text = raw.trim();
  if (!text) return { ok: false, error: `${label}을 입력해주세요.`, empty: true };
  if (text.length > max) return { ok: false, error: `${label}은 ${max}자까지 쓸 수 있어요.`, empty: false };
  return { ok: true, text };
}

/** 글 — 공백만이면 못 올린다 (버튼이 잠긴다). 앞뒤 공백은 서버도 자른다 */
export const checkPost = (raw: string): TextCheck => checkText(raw, POST_MAX, "내용");
export const checkComment = (raw: string): TextCheck => checkText(raw, COMMENT_MAX, "댓글");

/** 아바타에 넣는 글자 — 이름의 첫 글자(영문은 대문자). 비어 있으면 "?" */
export function initialOf(name: string | null | undefined): string {
  return (name ?? "").trim().charAt(0).toUpperCase() || "?";
}

/* ── 시간 ──────────────────────────────────────────────────── */

/**
 * "방금" / "12분 전" / "3시간 전" / "2일 전" / 7일이 넘으면 "9.04" (KST 날짜).
 * 서버 시계와 기기 시계가 어긋나 미래로 보이면 "방금"으로 묶는다.
 */
export function relativeTime(iso: string, now: number): string {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return "";
  const min = Math.floor((now - at) / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  const [, m, d] = kstDateKey(at).split("-");
  return `${Number(m)}.${d}`;
}

/* ── 랭킹 ──────────────────────────────────────────────────── */

export interface RankingView {
  rows: RankingEntry[];
  /** Top 10 밖의 내 순위 — 안에 이미 있으면 따로 보이지 않는다 */
  mine: RankingEntry | null;
}

export function rankingView(data: { ranking: RankingEntry[]; myRank: RankingEntry | null }): RankingView {
  const inList = data.ranking.some((r) => r.isMe);
  return { rows: data.ranking, mine: data.myRank && !inList ? data.myRank : null };
}

export const rankingEmptyText = (minAnalyses: number): string =>
  `아직 랭킹에 오른 사람이 없어요. 최근 7일간 일간 분석을 ${minAnalyses}회 이상 하면 순위에 등록됩니다.`;

export type { FeedComment, FeedPost, RankingEntry };
