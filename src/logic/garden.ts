/**
 * 정원 화면 계산 — 동물 상태 · 연속 기록 전망 · 성장 진행률.
 * 순수 함수만 둔다 (런타임 import는 공유 코드 `@/shared/*` 뿐) — Node로 검증한다 (scripts/verify-M6-logic.mjs).
 *
 * **"오늘"은 KST다 — 기기 시간대가 아니다.** 서버의 연속 기록(`lib/garden.ts` `updateAnimalStreak`)이 KST 날짜로
 * "어제 분석했나"를 가르므로, 배고픔 판정도 같은 경계여야 한다. 한국에서는 둘이 같고 다른 시간대의 기기에서만 갈린다.
 *
 * 웹과 다른 점 (docs/garden-game-design.md 3장)
 * 1. 웹은 "배고픔"을 `daysSince >= 2` 하나로만 본다. 앱은 그 앞에 **출출(peckish)** 을 둔다 — 어제까지 이어졌고 오늘 아직 안 준 날.
 * 2. 웹은 3일부터 "리셋 안내"를 하지만 서버는 **하루만 걸러도(daysSince >= 2) 다음 분석에서 연속 기록을 1로 되돌린다.**
 *    앱은 서버 동작대로 알린다 (`streakOutlook`).
 */
import type { GardenSnapshot } from "@/services/api-types";
import {
  ANIMAL_STAGES,
  getAnimalStage,
  getPlantLevel,
  nextPlantLevel,
  type AnimalTypeId,
} from "@/shared/garden-utils";
import { DAY_MS, kstDateKey } from "@/shared/kst";

export type PetCondition = "none" | "egg" | "fed" | "peckish" | "starving";

type AnimalState = NonNullable<GardenSnapshot["animal"]>;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** 마지막 분석일(KST 날짜 키)에서 오늘(KST)까지 며칠 — 오늘이면 0. 기록이 없거나 읽을 수 없으면 null */
export function daysSinceFed(lastAnalysisDate: string | null | undefined, now: number): number | null {
  if (!lastAnalysisDate || !DATE_KEY.test(lastAnalysisDate)) return null;
  const last = Date.parse(`${lastAnalysisDate}T00:00:00Z`);
  if (Number.isNaN(last)) return null;
  const today = Date.parse(`${kstDateKey(now)}T00:00:00Z`);
  // 기기 시계가 서버보다 앞서 "미래"가 되어도 음수로 내려가지 않게 한다
  return Math.max(0, Math.round((today - last) / DAY_MS));
}

/**
 * 동물의 지금 상태.
 *
 * - none     동물을 아직 고르지 않았다
 * - egg      골랐지만 한 번도 밥(분석)을 못 받았다 — 알
 * - fed      오늘 밥을 먹었다
 * - peckish  어제까지 이어졌고 오늘 아직 — 오늘 주면 연속 기록이 이어진다
 * - starving 하루 이상 걸렀다 — 연속 기록은 이미 끊겼다 (죽지는 않는다)
 */
export function petCondition(animal: GardenSnapshot["animal"], now: number): PetCondition {
  if (!animal?.type) return "none";
  const since = daysSinceFed(animal.lastAnalysisDate, now);
  if (since === null) return "egg";
  if (since === 0) return "fed";
  if (since === 1) return "peckish";
  return "starving";
}

export interface StreakOutlook {
  /** 서버가 지금 들고 있는 연속 기록 */
  current: number;
  /** 지금(오늘) 밥을 주면 될 연속 기록 — 서버 `updateAnimalStreak`와 같은 규칙 */
  afterFeeding: number;
  /** 밥을 줘도 연속 기록이 1로 되돌아가는가 (하루 이상 걸렀다) */
  willReset: boolean;
}

export function streakOutlook(animal: AnimalState, condition: PetCondition): StreakOutlook {
  const current = animal.streak;
  switch (condition) {
    case "fed":
      return { current, afterFeeding: current, willReset: false };
    case "peckish":
      return { current, afterFeeding: current + 1, willReset: false };
    case "starving":
      return { current, afterFeeding: 1, willReset: current > 1 };
    default:
      // egg · none — 첫 밥이 1일이다
      return { current, afterFeeding: 1, willReset: false };
  }
}

/** 조건별 한 줄 문구 — 한국어. 동물 이름은 모두 받침이 없어 조사가 갈리지 않는다 (고양이 · 강아지 · 토끼) */
export function conditionCopy(
  condition: PetCondition,
  outlook: StreakOutlook | null,
): { headline: string; sub: string } {
  switch (condition) {
    case "none":
      return { headline: "함께할 동물을 골라 주세요", sub: "선택은 웹과 앱에서 똑같이 이어져요." };
    case "egg":
      return { headline: "알이 부화를 기다리고 있어요", sub: "오늘 첫 분석을 하면 알에서 깨어나요." };
    case "fed":
      return {
        headline: "오늘 밥을 배부르게 먹었어요",
        sub: `${outlook?.current ?? 0}일째 함께하고 있어요.`,
      };
    case "peckish":
      return {
        headline: "슬슬 밥 먹을 시간이에요",
        sub: `오늘 분석하면 연속 기록이 ${outlook?.afterFeeding ?? 1}일로 이어져요.`,
      };
    case "starving":
      return {
        headline: "굶어서 힘이 없어요",
        sub: "지금 밥을 줘도 연속 기록은 1일부터 다시 시작해요. 그래도 곧 기운을 차릴 거예요.",
      };
  }
}

/** 조건 칩에 쓰는 짧은 이름 */
export const CONDITION_LABEL: Record<PetCondition, string> = {
  none: "미선택",
  egg: "알",
  fed: "배부름",
  peckish: "출출함",
  starving: "굶주림",
};

/* ── 성장 진행률 ────────────────────────────────────────────── */

export function plantProgress(totalMinutes: number) {
  const level = getPlantLevel(totalMinutes);
  const next = nextPlantLevel(level);
  return {
    level,
    next,
    /** 다음 단계까지 0~1 — 마지막 단계는 1 */
    ratio: next ? clamp01((totalMinutes - level.minMinutes) / (next.minMinutes - level.minMinutes)) : 1,
    remainMinutes: next ? next.minMinutes - totalMinutes : 0,
  };
}

export function animalProgress(streak: number) {
  const stage = getAnimalStage(streak);
  const next = ANIMAL_STAGES.find((s) => s.minStreak > streak) ?? null;
  return {
    stage,
    /** 1부터 — "3 / 6" 표기용 */
    stageNumber: ANIMAL_STAGES.findIndex((s) => s.status === stage.status) + 1,
    next,
    ratio: next ? clamp01((streak - stage.minStreak) / (next.minStreak - stage.minStreak)) : 1,
    remainDays: next ? next.minStreak - streak : 0,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** 동물 종류 ↔ 성격 한 줄 — 선택 화면 카드에 쓴다 */
export const ANIMAL_TRAITS: Record<AnimalTypeId, string> = {
  cat: "도도하지만 정이 많아요",
  dog: "언제나 반갑게 맞아 줘요",
  rabbit: "조용히 곁을 지켜 줘요",
};
