/**
 * 목표 화면 계산 (M7 7-1) — 목록 나누기 · 기간 진행률 · 입력 검증 · 수정 본문. 순수 함수만 둔다 (런타임 import는 `@/logic/calendar` · `@/shared/*` 뿐) —
 * Node로 검증한다 (scripts/verify-M7-logic.mjs).
 *
 * **날짜는 날짜만 쓰고 "오늘"은 KST다.** 서버가 "2026-10-13"을 UTC 자정으로 저장하므로 시작일 · 종료일은 `iso.slice(0, 10)`이 사용자가 고른 날짜 그대로다
 * (시각이 섞인 값이 오지 않는다 — 우리 클라이언트는 날짜만 보낸다). 웹 폼의 기본값도 KST 오늘이라(`kstDateKey`) 같은 기준을 쓴다.
 *
 * 웹과 다른 점
 *  1. 웹 `progress()`는 기기 시간대의 `setHours(0)`으로 센다. 앱은 KST 날짜 키로 센다 — 기기가 어느 시간대여도 같은 답이다.
 *  2. 시작 전인 목표를 "시작 전"으로 알린다 (웹은 0일 지남 · n일 남음으로만 보인다).
 *  3. 입력 검증을 서버와 같은 규칙으로 앱에서도 미리 한다 — 제목 1~200자 · 하루 1~10080분 · 종료일은 시작일 이후.
 */
import { addDays, daysBetween, isDateKey } from "@/logic/calendar";
import type { CreateGoalInput, Goal, UpdateGoalInput } from "@/services/api-types";
import { kstDateKey } from "@/shared/kst";

/** 하루 목표 시간 빠른 선택 (웹과 같다) */
export const GOAL_PRESETS = [30, 60, 90, 120, 180] as const;
export const GOAL_TITLE_MAX = 200;
export const GOAL_MINUTES_MAX = 10080;
/** 새 목표의 기본 기간 (일) — 웹과 같다 */
export const GOAL_DEFAULT_DAYS = 7;
/** 목표를 완료하면 서버가 식물 경험치로 주는 분 (`onGoalCompleted`) — 안내 문구용, 앱이 올리지 않는다 */
export const GOAL_COMPLETE_EXP = 20;

/** 서버가 준 날짜(UTC 자정 ISO) → 날짜 키 */
export function goalDateKey(iso: string): string {
  return iso.slice(0, 10);
}

export interface GoalSpan {
  /** 기간 전체 일 수 (시작일 · 종료일 포함) */
  total: number;
  /** 시작일부터 오늘까지 지난 일 수 (오늘 포함 · 0 ~ total) */
  done: number;
  /** 남은 일 수 (0이면 오늘이 마지막 날이거나 이미 끝났다 — `expired`로 가른다) */
  left: number;
  /** 0~100 */
  pct: number;
  /** 아직 시작 전 — 시작까지 남은 일 수 (시작했으면 0) */
  startsIn: number;
  /** 종료일이 지났다 (종료일 당일은 아직 아니다) */
  expired: boolean;
}

/** 기간 대비 경과일 — 달성률이 아니라 **진행률**이다 (달성 여부는 사용자가 직접 완료 처리한다 · 서버에 완료 시각이 없다) */
export function goalSpan(goal: Pick<Goal, "startDate" | "endDate">, now: number): GoalSpan {
  const start = goalDateKey(goal.startDate);
  const end = goalDateKey(goal.endDate);
  const today = kstDateKey(now);
  const length = daysBetween(start, end);
  const sinceStart = daysBetween(start, today);
  const total = Math.max(1, (length ?? 0) + 1);
  const done = sinceStart === null ? 0 : Math.max(0, Math.min(total, sinceStart + 1));
  const startsIn = sinceStart !== null && sinceStart < 0 ? -sinceStart : 0;
  // 끝난 것은 종료일 **다음 날**부터다 — 종료일 당일은 남은 날이 0이어도 아직 기간 안이다 (웹은 마지막 날에도 "끝났어요"라고 했다)
  const pastEnd = daysBetween(end, today);
  return {
    total,
    done,
    left: total - done,
    pct: Math.round((done / total) * 100),
    startsIn,
    expired: pastEnd !== null && pastEnd > 0,
  };
}

/** 진행 중(= 완료가 아닌 것 · 일시정지 포함 — 웹과 같다) · 완료. 순서는 서버가 준 대로(최신 생성순) */
export function splitGoals(goals: Goal[]): { active: Goal[]; done: Goal[] } {
  return {
    active: goals.filter((g) => g.status !== "completed"),
    done: goals.filter((g) => g.status === "completed"),
  };
}

export function goalsEyebrow(goals: Goal[] | null): string {
  if (!goals) return "불러오는 중";
  const { active, done } = splitGoals(goals);
  return `진행 중 ${active.length}개 · 완료 ${done.length}개`;
}

/** 진행 줄 — "7일 중 1일 지남 · 6일 남음" · 시작 전 · 끝남 */
export function goalNote(span: GoalSpan): string {
  if (span.startsIn > 0) return `아직 시작 전이에요 · ${span.startsIn}일 뒤 시작`;
  const base = `${span.total}일 중 ${span.done}일 지남`;
  if (span.expired) return `${base} · 기간이 끝났어요`;
  return span.left === 0 ? `${base} · 오늘이 마지막 날이에요` : `${base} · ${span.left}일 남음`;
}

/* ── 입력 ──────────────────────────────────────────────────── */

export interface GoalForm {
  title: string;
  /** 입력 중에는 비어 있을 수 있다 */
  targetMinutes: number | null;
  startDate: string;
  endDate: string;
}

/** 새 목표 기본값 — 오늘(KST)부터 일주일 */
export function defaultGoalForm(now: number): GoalForm {
  const today = kstDateKey(now);
  return { title: "", targetMinutes: 60, startDate: today, endDate: addDays(today, GOAL_DEFAULT_DAYS) };
}

export function formFromGoal(goal: Goal): GoalForm {
  return {
    title: goal.title,
    targetMinutes: goal.targetMinutes,
    startDate: goalDateKey(goal.startDate),
    endDate: goalDateKey(goal.endDate),
  };
}

export type GoalFormResult = { ok: true; input: CreateGoalInput } | { ok: false; error: string };

/** 서버와 같은 규칙으로 미리 걸러 낸다 (서버도 같은 이유로 400을 낸다) — 문구는 웹 폼과 같다 */
export function validateGoalForm(form: GoalForm): GoalFormResult {
  const title = form.title.trim();
  if (!title) return { ok: false, error: "제목을 입력해주세요." };
  if (title.length > GOAL_TITLE_MAX) return { ok: false, error: `제목은 ${GOAL_TITLE_MAX}자까지 쓸 수 있어요.` };
  const minutes = form.targetMinutes;
  if (minutes === null || !Number.isInteger(minutes) || minutes < 1 || minutes > GOAL_MINUTES_MAX) {
    return { ok: false, error: `하루 목표 시간은 1~${GOAL_MINUTES_MAX}분으로 정해주세요.` };
  }
  if (!isDateKey(form.startDate) || !isDateKey(form.endDate)) return { ok: false, error: "기간을 설정해주세요." };
  if (form.endDate <= form.startDate) return { ok: false, error: "종료일은 시작일 이후여야 합니다." };
  return { ok: true, input: { title, targetMinutes: minutes, startDate: form.startDate, endDate: form.endDate } };
}

/** 시작일을 바꿨는데 종료일이 그 이전이 되면 종료일을 시작일 일주일 뒤로 끌고 간다 (둘이 어긋난 채로 저장 버튼을 누르게 두지 않는다) */
export function withStartDate(form: GoalForm, startDate: string): GoalForm {
  return form.endDate > startDate ? { ...form, startDate } : { ...form, startDate, endDate: addDays(startDate, GOAL_DEFAULT_DAYS) };
}

/** 수정 요청 본문 — 바뀐 필드만 (서버는 PATCH로 받은 필드만 고친다). 바뀐 것이 없으면 null */
export function patchFromForm(goal: Goal, input: CreateGoalInput): UpdateGoalInput | null {
  const patch: UpdateGoalInput = {};
  if (input.title !== goal.title) patch.title = input.title;
  if (input.targetMinutes !== goal.targetMinutes) patch.targetMinutes = input.targetMinutes;
  if (input.startDate !== goalDateKey(goal.startDate)) patch.startDate = input.startDate;
  if (input.endDate !== goalDateKey(goal.endDate)) patch.endDate = input.endDate;
  return Object.keys(patch).length === 0 ? null : patch;
}

/** 숫자 입력칸의 글자 → 분. 숫자가 아닌 글자는 버리고, 비면 null, 상한을 넘으면 상한으로 */
export function parseMinutes(text: string): number | null {
  const digits = text.replace(/[^0-9]/g, "");
  if (digits === "") return null;
  return Math.min(GOAL_MINUTES_MAX, parseInt(digits, 10));
}
