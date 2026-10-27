/**
 * 커뮤니티 신고 · 차단 · 이용 규칙 (M9 — Google Play 사용자 생성 콘텐츠(UGC) 정책). 순수 값만 둔다 — Node로 검증한다 (scripts/verify-M9-moderation-logic.mjs).
 *
 * 서버(웹 `lib/moderation.ts`)와 **사유 값이 같아야 한다** — 검증이 웹 소스를 읽어 둘이 어긋나면 막는다.
 * 규칙 문구는 실제 동작과 같아야 한다 (거짓이면 스토어 정책 위반): 신고한 글은 신고한 사람에게 곧바로 숨고 · 서로 다른 3명이 신고하면 모두에게서 숨고 · 운영자가 확인해 지운다.
 */

export const REPORT_REASONS = [
  { value: "spam", label: "스팸 · 광고", hint: "홍보 · 반복 글 · 낚시" },
  { value: "abuse", label: "욕설 · 혐오 · 괴롭힘", hint: "비방 · 차별 · 위협" },
  { value: "sexual", label: "음란 · 선정적인 내용", hint: "성적인 글 · 청소년에게 부적절한 내용" },
  { value: "privacy", label: "개인정보 노출 · 사칭", hint: "연락처 · 실명 공개 · 다른 사람인 척" },
  { value: "other", label: "기타", hint: "위에 없는 문제" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export type ModerationTarget = "post" | "comment";

/** 이용 규칙 버전 — 규칙을 바꾸면 올려서 다시 동의받는다 */
export const RULES_VERSION = 1;

/** 사용자별 저장 키 (AsyncStorage) — 값은 동의한 규칙 버전 */
export const rulesKey = (uid: string): string => `offlo_community_rules:${uid}`;

/** 저장된 값이 현재 규칙에 동의한 것인가 (없거나 옛 버전이면 아니다) */
export function rulesAccepted(stored: string | null | undefined): boolean {
  const version = Number(stored);
  return Number.isInteger(version) && version >= RULES_VERSION;
}

export interface RuleItem {
  title: string;
  body: string;
}

/** 커뮤니티 이용 규칙 — 글 · 댓글 쓰기 전에 보여 주고 동의를 받는다 */
export const COMMUNITY_RULES: readonly RuleItem[] = [
  { title: "서로 존중해요", body: "욕설 · 비방 · 혐오 · 차별 · 괴롭힘은 안 돼요. 디톡스를 응원하는 말을 나눠요." },
  { title: "광고 · 스팸은 안 돼요", body: "홍보 · 낚시 · 같은 글 반복 올리기는 지워져요." },
  { title: "선정적인 내용은 안 돼요", body: "음란하거나 청소년에게 부적절한 글 · 사진 · 링크는 올릴 수 없어요." },
  { title: "개인정보를 지켜요", body: "내 연락처나 다른 사람의 이름 · 연락처 · 사진을 올리지 마세요. 다른 사람인 척하는 것도 안 돼요." },
  { title: "불법 · 위험한 내용은 안 돼요", body: "법에 어긋나거나 자신 · 타인을 해치도록 부추기는 내용은 올릴 수 없어요." },
];

/** 규칙을 어겼을 때 어떻게 되는지 — 실제 동작과 같게 쓴다 */
export const RULES_ENFORCEMENT: readonly string[] = [
  "누구나 글 · 댓글의 '신고 · 차단'을 눌러 알릴 수 있어요. 신고한 글은 신고한 사람에게 바로 숨겨져요.",
  "서로 다른 3명이 신고한 글 · 댓글은 확인하기 전에도 다른 사람에게 보이지 않아요.",
  "운영자가 신고를 확인해 규칙을 어긴 글 · 댓글은 지우고, 반복하면 이용을 제한할 수 있어요.",
  "보기 싫은 사용자는 차단할 수 있어요. 차단한 사람의 글 · 댓글 · 랭킹은 내게 보이지 않고, 설정 → 차단한 사용자에서 풀 수 있어요.",
];

export const RULES_TITLE = "커뮤니티 이용 규칙";

/** 신고 · 차단을 마친 뒤 피드 위에 잠깐 띄우는 안내 */
export const NOTICE_REPORTED = "신고했어요. 이 글은 이제 보이지 않아요. 운영자가 확인할게요.";
export const NOTICE_REPORTED_COMMENT = "신고했어요. 이 댓글은 이제 보이지 않아요. 운영자가 확인할게요.";
export const noticeBlocked = (name: string): string => `${name}님을 차단했어요. 이 사용자의 글 · 댓글은 이제 보이지 않아요.`;

export const blockConfirmText = (name: string): string => `${name}님의 글 · 댓글 · 랭킹이 내게 보이지 않아요. 상대에게 알리지 않고, 설정 → 차단한 사용자에서 언제든 풀 수 있어요.`;

/** 차단 목록이 비었을 때 */
export const BLOCKED_EMPTY = "차단한 사용자가 없어요. 글이나 댓글의 '신고 · 차단'에서 사용자를 차단할 수 있어요.";
