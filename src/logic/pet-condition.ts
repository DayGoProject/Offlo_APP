/**
 * 동물의 지금 상태 — 알 · 배부름 · 출출 · 굶주림. 순수 함수만 둔다 (런타임 import는 공유 코드 `@/shared/*` 뿐) — Node로 검증한다 (scripts/verify-M6-logic.mjs).
 * **웹으로 복사되는 파일이다** (`node scripts/sync-pet-web.mjs --push` → 웹 `lib/pet/condition.ts`) — 앱 전용 import(`@/services/*` 등)를 넣지 않는다.
 *
 * **"오늘"은 KST다 — 기기 시간대가 아니다.** 서버의 연속 기록(`lib/garden.ts` `updateAnimalStreak`)이 KST 날짜로
 * "어제 분석했나"를 가르므로, 배고픔 판정도 같은 경계여야 한다. 한국에서는 둘이 같고 다른 시간대의 기기에서만 갈린다.
 */
import { DAY_MS, kstDateKey } from "@/shared/kst";

export type PetCondition = "none" | "egg" | "fed" | "peckish" | "starving";

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

/** 상태를 가르는 데 필요한 값만 — 앱(`GardenSnapshot["animal"]`)과 웹(`AnimalData`)이 둘 다 이 모양을 만족한다 */
export interface PetConditionInput {
  /** 고른 동물 종류 — 없으면 아직 고르지 않았다 */
  type: string | null;
  lastAnalysisDate?: string | null;
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
export function petCondition(animal: PetConditionInput | null | undefined, now: number): PetCondition {
  if (!animal?.type) return "none";
  const since = daysSinceFed(animal.lastAnalysisDate, now);
  if (since === null) return "egg";
  if (since === 0) return "fed";
  if (since === 1) return "peckish";
  return "starving";
}

/** 조건 칩에 쓰는 짧은 이름 */
export const CONDITION_LABEL: Record<PetCondition, string> = {
  none: "미선택",
  egg: "알",
  fed: "배부름",
  peckish: "출출함",
  starving: "굶주림",
};
