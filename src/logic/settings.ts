/**
 * 설정 화면 계산 (M7 7-4) — 이름 검증 · 회원 탈퇴 확인 문구 · 로그인 방식 라벨. 순수 함수만 둔다 (import 없음) — Node로 검증한다 (scripts/verify-M7-logic.mjs).
 *
 * 비밀번호 변경 · 테마 항목은 **없다** — 로그인은 소셜 전용이고(Google · Apple) 화면은 다크 단일 테마다.
 */

/** 서버 `PATCH /api/users/me`와 같은 한도 (이름 1~100자) */
export const NAME_MAX = 100;
/** 회원 탈퇴 확인 문구 — 화면 안내와 검사가 같은 상수를 본다 (웹 설정과 같다) */
export const DELETE_PHRASE = "탈퇴";

export type NameCheck = { ok: true; name: string; changed: boolean } | { ok: false; error: string; empty: boolean };

/** 이름 저장 검사 — 앞뒤 공백을 자른다. `changed`가 false면 지금 이름과 같아 보낼 필요가 없다 */
export function checkName(raw: string, current: string): NameCheck {
  const name = raw.trim();
  if (!name) return { ok: false, error: "이름을 입력해주세요.", empty: true };
  if (name.length > NAME_MAX) return { ok: false, error: `이름은 ${NAME_MAX}자까지 쓸 수 있어요.`, empty: false };
  return { ok: true, name, changed: name !== current.trim() };
}

/** 확인 문구를 정확히 입력했는가 (앞뒤 공백은 봐준다) */
export const canDeleteAccount = (typed: string): boolean => typed.trim() === DELETE_PHRASE;

/** Firebase `providerData[].providerId` → 사용자에게 보이는 로그인 방식 */
export function providerLabel(providerIds: readonly string[]): string {
  if (providerIds.includes("google.com")) return "Google";
  if (providerIds.includes("apple.com")) return "Apple";
  if (providerIds.includes("password")) return "이메일";
  return "소셜 로그인";
}

/** 서버 수정(`PATCH /api/users/me`)이 아직 배포되지 않았을 때 — 라우트가 없거나(404) 이 메서드를 못 받는다(405) */
export function nameSaveHint(status: number, message: string): string {
  if (status === 404 || status === 405) return "이 서버는 아직 이름 변경을 지원하지 않아요. 서버가 업데이트된 뒤에 다시 시도해주세요.";
  return message;
}

/** 탈퇴로 함께 지워지는 것 — 화면 안내와 같은 목록 (서버 `DELETE /api/users/me`가 하는 일) */
export const DELETE_LOSSES = ["분석 기록과 결과", "목표와 배지", "커뮤니티에 쓴 글 · 댓글 · 좋아요", "정원(식물 · 동물 · 쓰다듬기 기록)", "로그인 계정"] as const;

/** 가입일 "2026.08.01" — 서버 `createdAt`은 UTC ISO라 한국 날짜로 센다 (기기 시간대와 무관) */
export function joinedLabel(iso: string): string {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return "";
  const kst = new Date(at + 9 * 3_600_000).toISOString().slice(0, 10);
  return kst.replace(/-/g, ".");
}
