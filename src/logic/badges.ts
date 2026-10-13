/**
 * 배지 화면 계산 (M7 7-2) — 잠긴 배지의 진행도 · 목록 나누기 · 자랑하기 입력. 순수 함수만 둔다 (런타임 import는 `@/logic/analysis` · `@/shared/*` 뿐) —
 * Node로 검증한다 (scripts/verify-M7-logic.mjs).
 *
 * 배지 **지급**은 서버(`awardBadge`)가 한다 — 앱은 읽어서 보여 주고 자랑하기(커뮤니티 글)만 보낸다. 배지 이름 · 이모지 · 달성 조건은 공유 코드
 * `shared/badge-utils.ts`(웹이 원본)의 `ALL_BADGES`를 그대로 쓴다.
 *
 * 웹과 다른 점
 *  1. 잠긴 배지의 "이번 주 일간 분석 n / 7"을 **KST 월~일**로 센다 (웹은 기기 시간대의 월요일 0시) — 서버의 주 경계와 같다.
 *  2. 분석 목록 · 연속 기록을 못 읽었으면 진행 막대를 그리지 않는다 (0으로 속여 그리지 않는다) — `BadgeStats | null`.
 */
import { thisWeekDaily } from "@/logic/analysis";
import type { AnalysisSummary, Badge } from "@/services/api-types";
import { ALL_BADGES, getBadgeDef, type BadgeDef } from "@/shared/badge-utils";

/** 배지 글 한마디 최대 길이 (서버 `MAX_POST_LENGTH`와 같다 — 웹 `services/community.ts`) */
export const SHARE_MESSAGE_MAX = 1000;

export interface BadgeStats {
  /** 지금까지의 분석 수 (일간 + 주간 · 최근 100건까지) */
  total: number;
  weekly: number;
  /** 이번 주(KST 월~일) 일간 분석 수 */
  dailyThisWeek: number;
  /** 동물의 연속 기록 */
  streak: number;
}

export function badgeStats(analyses: AnalysisSummary[], streak: number, now: number): BadgeStats {
  return {
    total: analyses.length,
    weekly: analyses.filter((a) => a.periodType === "weekly").length,
    dailyThisWeek: thisWeekDaily(analyses, now).length,
    streak: Number.isFinite(streak) && streak > 0 ? Math.floor(streak) : 0,
  };
}

export interface LockedProgress {
  /** 0~1 — 센 값이 없으면 null (막대를 그리지 않는다) */
  ratio: number | null;
  note: string;
}

/** 잠긴 배지의 진행도 — 0~1과 남은 만큼을 설명하는 한 줄 */
export function lockedProgress(name: string, stats: BadgeStats | null): LockedProgress {
  const requirement = getBadgeDef(name)?.requirement ?? "";
  if (!stats) return { ratio: null, note: requirement };
  switch (name) {
    case "첫 분석":
      return { ratio: Math.min(1, stats.total), note: "AI 분석 1회면 획득" };
    case "주간 분석 완료":
      return { ratio: Math.min(1, stats.dailyThisWeek / 7), note: `이번 주 일간 분석 ${stats.dailyThisWeek} / 7회` };
    case "7일 연속":
      return {
        ratio: Math.min(1, stats.streak / 7),
        note: stats.streak > 0 ? `${Math.max(0, 7 - stats.streak)}일 더 이어가면 획득` : "연속 기록을 시작해 보세요",
      };
    case "목표 달성":
      return { ratio: 0, note: "목표를 하나 완료하면 획득" };
    default:
      return { ratio: 0, note: requirement };
  }
}

/** 획득한 배지(서버 순서 = 최근 획득순)와 아직 잠긴 배지(정의 순서) */
export function splitBadges(badges: Badge[]): { earned: Badge[]; locked: BadgeDef[] } {
  const earnedNames = new Set(badges.map((b) => b.name));
  return { earned: badges, locked: ALL_BADGES.filter((b) => !earnedNames.has(b.name)) };
}

export function badgesEyebrow(badges: Badge[] | null): string {
  if (!badges) return "불러오는 중";
  const { earned, locked } = splitBadges(badges);
  return `${earned.length}개 획득 · ${locked.length}개 남음`;
}

/** 자랑하기 한마디 검증 — 선택 사항이라 비어도 된다. 길이만 막는다 (서버도 1000자 초과는 400) */
export function shareMessage(raw: string): { ok: true; content: string } | { ok: false; error: string } {
  const content = raw.trim();
  if (content.length > SHARE_MESSAGE_MAX) return { ok: false, error: `한마디는 ${SHARE_MESSAGE_MAX}자까지 쓸 수 있어요.` };
  return { ok: true, content };
}
