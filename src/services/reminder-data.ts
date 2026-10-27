/**
 * 리마인더 계획에 필요한 자료를 서버에서 읽는다 — **켜진 종류가 쓰는 것만** (`sourcesNeeded`). 모두 읽기라 재시도해도 안전하다 (`api-client`가 GET은 알아서 재시도한다).
 * 하나가 실패해도 나머지는 쓴다 — 실패한 것은 null로 돌려 `planReminders`가 "모른다"로 다루게 한다 (그 종류의 기존 예약을 지우지 않는다).
 */
import type { PlanSources, sourcesNeeded } from "@/logic/reminders";
import { api } from "@/services/api";
import { readGarden } from "@/services/garden";

const orNull = <T>(promise: Promise<T>): Promise<T | null> => promise.then((v) => v, () => null);

export async function loadReminderSources(uid: string, needed: ReturnType<typeof sourcesNeeded>): Promise<PlanSources> {
  const [analyses, goals, garden] = await Promise.all([
    needed.analyses ? orNull(api.analyses.list({ periodType: "daily", limit: 7 })) : null,
    needed.goals ? orNull(api.goals.list("active")) : null,
    needed.garden ? orNull(readGarden(uid)) : null,
  ]);
  return {
    analyses: analyses?.analyses ?? null,
    goals: goals?.goals ?? null,
    garden: garden ? { animal: garden.animal ? { type: garden.animal.type, lastAnalysisDate: garden.animal.lastAnalysisDate } : null } : null,
  };
}
