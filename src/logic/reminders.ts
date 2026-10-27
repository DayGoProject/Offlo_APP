/**
 * 로컬 예약 알림 계획 (M8) — "언제 무슨 알림을 예약할까"를 정하는 순수 함수만 둔다 (런타임 import는 `@/logic/*` · `@/shared/*` 뿐) —
 * Node로 검증한다 (scripts/verify-M8-reminders.mjs). 실제 예약은 `services/reminders.ts`가 한다.
 *
 * 서버 없이 해결하는 시간 기반 알림 셋 (웹 10단계 Phase 3 — Cloud Functions 스케줄러가 미룬 몫):
 *  - evening  저녁 분석 리마인더 — 매일 **KST 21시**, 그날 일간 분석을 아직 안 했으면
 *  - hungry   동물 배고픔 — 매일 **KST 10시**, 밥(분석)을 **이틀 이상** 못 먹었으면 (동물이 있고 알이 아닐 때)
 *  - goal     목표 마감 D-1 — 종료일 하루 전 **KST 10시**
 *
 * **알림은 "그때 확인해서" 울리지 않는다** — 로컬 알림은 예약 시점에 내용이 정해진다. 그래서 앞으로 며칠치를 예약해 두고, 앱을 열 때 · 분석 · 목표가 바뀔 때마다 **다시 계산해 갈아 끼운다**
 * (분석은 앱에서만 하므로 분석을 저장하는 순간 그날의 리마인더가 빠진다). 안 열면 **앞으로 울릴 저녁 3번 · 배고픔 아침 2번**까지만 울리고 멈춘다 — 떠난 사람을 계속 두드리지 않는다.
 *
 * 시각은 KST로 못 박는다 (분석 하루 1회 · 연속 기록 경계가 KST — `shared/kst.ts`). 한국에서 기기 시간대와 같고 다른 시간대의 기기에서도 서버의 하루와 맞는다.
 */
import { todayDaily } from "@/logic/analysis";
import { addDays, daysBetween, isDateKey } from "@/logic/calendar";
import { goalDateKey } from "@/logic/goals";
import type { AnalysisSummary, Goal } from "@/services/api-types";
import { ANIMAL_TYPES } from "@/shared/garden-utils";
import { kstDateKey } from "@/shared/kst";

export type ReminderKind = "evening" | "hungry" | "goal";
export const REMINDER_KINDS: readonly ReminderKind[] = ["evening", "hungry", "goal"];

export type ReminderPrefs = Record<ReminderKind, boolean>;

/** 켜는 것은 사용자의 선택이다 — 처음엔 모두 꺼져 있고, 켤 때 알림 권한을 묻는다 */
export const DEFAULT_PREFS: ReminderPrefs = { evening: false, hungry: false, goal: false };

export const EVENING_HOUR = 21;
export const MORNING_HOUR = 10;
/** 앞으로 울릴 몇 번을 예약해 두는가 — 오늘 몫이 빠지면(이미 지났거나 오늘 분석함) 하루씩 뒤로 밀어 채운다 */
export const EVENING_DAYS = 3;
export const HUNGRY_DAYS = 2;
/** 목표 마감 알림은 이 기간 안(일)에 오는 것만 예약한다 — 앱을 열 때마다 다시 계산하므로 더 먼 것은 나중에 들어온다 */
export const GOAL_HORIZON_DAYS = 14;
export const GOAL_MAX = 10;
/** 지금과 너무 가까운 예약은 거른다 (예약하는 사이 지나가 버린다) */
export const MIN_LEAD_MS = 30_000;
/** 이틀 이상 못 먹었을 때 배고픔 알림 */
export const HUNGRY_AFTER_DAYS = 2;

export const REMINDER_COPY: Record<ReminderKind, { title: string; hint: string }> = {
  evening: { title: "저녁 분석 리마인더", hint: "그날 분석을 아직 안 했으면 밤 9시에 알려요." },
  hungry: { title: "동물 배고픔", hint: "밥(분석)을 이틀 넘게 못 줬으면 오전 10시에 알려요." },
  goal: { title: "목표 마감 하루 전", hint: "진행 중인 목표가 내일 끝나면 오전 10시에 알려요." },
};

/** 저장소에서 읽은 값 → 설정. 깨졌거나 없으면 켜지 않은 것으로 본다 */
export function normalizePrefs(raw: unknown): ReminderPrefs {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    evening: obj.evening === true,
    hungry: obj.hungry === true,
    goal: obj.goal === true,
  };
}

export const anyOn = (prefs: ReminderPrefs): boolean => REMINDER_KINDS.some((k) => prefs[k]);

/**
 * 기기의 알림 권한 — unsupported: 이 환경(웹 · Expo Go)에서는 예약 알림을 쓸 수 없다.
 * (라이브러리가 주는 `canAskAgain`은 쓰지 않는다 — 안드로이드에서 시스템의 실제 상태와 어긋날 수 있다(기기 설정에서 껐다 켠 뒤 등). 허용 전이면 **항상 요청하고 결과로 판단한다**:
 * 시스템이 더는 창을 못 띄우는 상태면 창 없이 곧바로 거절이 돌아와 같은 안내(+ 기기 설정 버튼)가 뜬다.)
 */
export interface ReminderPermission {
  state: "granted" | "denied" | "undetermined" | "unsupported";
}

export const PERMISSION_UNSUPPORTED: ReminderPermission = { state: "unsupported" };

export interface PlannedReminder {
  /** 예약 식별자 — 종류 접두어 + 날짜(목표는 목표 id). 같은 계획을 다시 예약해도 겹치지 않는다 */
  id: string;
  kind: ReminderKind;
  /** 울릴 시각 (ms) */
  at: number;
  title: string;
  body: string;
  /** 눌렀을 때 갈 화면 — 웹 경로 형식이라 `logic/notifications.ts` `routeFor`가 앱 화면으로 바꾼다 */
  link: string;
}

export interface PlanInput {
  now: number;
  prefs: ReminderPrefs;
  /** 오늘(KST) 일간 분석을 했는가 — null: 모른다(분석 목록을 못 읽었다) */
  analyzedToday: boolean | null;
  /** 동물 문서 — null: 모른다(못 읽었다) · `{ type: null }`: 아직 안 골랐다 */
  animal: { type: string | null; lastAnalysisDate: string | null } | null;
  /** 목표 목록 — null: 모른다(못 읽었다) */
  goals: Goal[] | null;
}

/** 서버에서 읽어 온 원자료 — 읽기에 실패한 것은 null (실패를 "없음"으로 바꾸지 않는다) */
export interface PlanSources {
  /** 최근 일간 분석 목록 */
  analyses: AnalysisSummary[] | null;
  goals: Goal[] | null;
  /** 정원 문서 — `animal`이 null이면 동물 문서가 없다(아직 안 골랐다) */
  garden: { animal: { type: string | null; lastAnalysisDate: string | null } | null } | null;
}

/** 원자료 → 계획에 넣을 값. 못 읽은 것은 null로 남겨 `planReminders`가 "모른다"로 다루게 한다 */
export function planInputFrom(sources: PlanSources, now: number): Pick<PlanInput, "analyzedToday" | "animal" | "goals"> {
  return {
    analyzedToday: sources.analyses === null ? null : todayDaily(sources.analyses, now) !== null,
    animal: sources.garden === null ? null : (sources.garden.animal ?? { type: null, lastAnalysisDate: null }),
    goals: sources.goals,
  };
}

export interface Plan {
  items: PlannedReminder[];
  /** 이 종류는 지금 값으로 "완전히" 계획했는가 — false면 기존 예약을 지우지 말고 그대로 둔다 (읽기 실패를 "알림 없음"으로 착각하면 예약이 사라진다) */
  complete: ReminderKind[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** KST 날짜 키 + 시각 → 시각(ms) */
export function kstAt(dateKey: string, hour: number): number {
  return Date.parse(`${dateKey}T${pad(hour)}:00:00+09:00`);
}

const truncate = (text: string, max: number) => {
  const chars = [...text.trim()];
  return chars.length <= max ? chars.join("") : `${chars.slice(0, max - 1).join("")}…`;
};

/** 동물 종류 → 이름 ("고양이") — 모르는 종류면 그냥 "동물" */
export function petName(type: string | null | undefined): string {
  return ANIMAL_TYPES.find((a) => a.id === type)?.name ?? "동물";
}

export function planReminders({ now, prefs, analyzedToday, animal, goals }: PlanInput): Plan {
  const items: PlannedReminder[] = [];
  const complete: ReminderKind[] = [];
  const today = kstDateKey(now);
  const future = (at: number) => at > now + MIN_LEAD_MS;

  /* 저녁 — 오늘은 분석 여부를 알아야 하고, 내일부터는 늘 예약한다 (분석하면 그때 다시 계산해 빼므로) */
  if (prefs.evening) {
    for (let i = 0; items.length < EVENING_DAYS && i <= EVENING_DAYS; i++) {
      const day = addDays(today, i);
      const at = kstAt(day, EVENING_HOUR);
      if (!future(at)) continue;
      if (i === 0 && analyzedToday !== false) continue; // 오늘 이미 했거나(true) 아직 모른다(null)
      items.push({
        id: `offlo-evening-${day}`,
        kind: "evening",
        at,
        title: "오늘 분석이 아직이에요 ⏰",
        body: "자기 전에 오늘의 스크린타임을 분석하고 연속 기록을 이어가세요.",
        link: "/analysis",
      });
    }
    if (analyzedToday !== null || kstAt(today, EVENING_HOUR) <= now + MIN_LEAD_MS) complete.push("evening");
  }

  /* 배고픔 — 동물이 있고 한 번이라도 먹은 적이 있어야 하고, 그날 아침에 이틀 이상 못 먹은 상태일 때 */
  if (prefs.hungry) {
    if (animal) {
      // 오늘 분석했으면 동물 문서(서버가 분석 뒤에 갱신한다)가 아직 옛 값이어도 오늘 먹은 것으로 본다
      const last = analyzedToday === true ? today : animal.lastAnalysisDate;
      if (animal.type && last && isDateKey(last)) {
        const hungryItems: PlannedReminder[] = [];
        for (let i = 0; hungryItems.length < HUNGRY_DAYS && i <= HUNGRY_DAYS + HUNGRY_AFTER_DAYS; i++) {
          const day = addDays(today, i);
          const at = kstAt(day, MORNING_HOUR);
          if (!future(at)) continue;
          const gap = daysBetween(last, day);
          if (gap === null || gap < HUNGRY_AFTER_DAYS) continue;
          hungryItems.push({
            id: `offlo-hungry-${day}`,
            kind: "hungry",
            at,
            title: `${petName(animal.type)}가 배고파해요 🍽️`,
            body: `${gap}일째 밥을 못 먹었어요. 오늘 분석하면 밥을 줄 수 있어요.`,
            link: "/analysis",
          });
        }
        items.push(...hungryItems);
      }
      complete.push("hungry");
    }
  }

  /* 목표 마감 D-1 — 진행 중인 목표만 · 종료일 하루 전 아침 · 이미 시작한 뒤여야 한다 */
  if (prefs.goal && goals) {
    const picked: PlannedReminder[] = [];
    for (const goal of goals) {
      if (goal.status !== "active") continue;
      const end = goalDateKey(goal.endDate);
      const start = goalDateKey(goal.startDate);
      if (!isDateKey(end) || !isDateKey(start)) continue;
      const day = addDays(end, -1);
      const at = kstAt(day, MORNING_HOUR);
      if (!future(at) || at > now + GOAL_HORIZON_DAYS * 86_400_000) continue;
      if ((daysBetween(start, day) ?? -1) < 0) continue; // 시작도 하기 전에 "하루 남았다"고 하지 않는다
      picked.push({
        id: `offlo-goal-${goal.id}`,
        kind: "goal",
        at,
        title: "목표 마감이 하루 남았어요 🎯",
        body: `‘${truncate(goal.title, 40)}’ 목표가 내일 끝나요. 지금까지 어땠는지 확인해 보세요.`,
        link: "/goals",
      });
    }
    picked.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    items.push(...picked.slice(0, GOAL_MAX));
    complete.push("goal");
  }

  items.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  return { items, complete };
}

/**
 * 기기 쪽 일 — 설정 저장 · 권한 · 예약. 실제(`services/reminders.ts`)와 미리보기(가짜)가 같은 훅(`use-reminder-settings`)을 거치도록 모양만 정해 둔다.
 * 모든 함수는 던지지 않는다 (실패는 조용히 넘기거나 돌려준 값으로 알린다) — 알림은 장식이라 앱을 막으면 안 된다.
 */
export interface ReminderService {
  /** false면 이 환경에서는 예약할 수 없다 (웹 · Expo Go) */
  supported: boolean;
  loadPrefs: () => Promise<ReminderPrefs>;
  savePrefs: (prefs: ReminderPrefs) => Promise<void>;
  getPermission: () => Promise<ReminderPermission>;
  /** 시스템 권한 창을 띄운다 (이미 허용했으면 그대로) */
  requestPermission: () => Promise<ReminderPermission>;
  /** 기기의 앱 설정 화면 — 권한을 두 번 거절한 사람이 직접 켜러 간다 */
  openSettings: () => void;
  /** 계획을 기기에 반영한다 — 설정이 꺼진 종류와 계산이 끝난 종류만 기존 예약을 갈아 끼운다 */
  sync: (plan: Plan, prefs: ReminderPrefs) => Promise<void>;
  /** 우리 예약을 모두 지운다 (로그아웃 · 권한을 잃었을 때) */
  cancelAll: () => Promise<void>;
}

/** 켜진 종류가 읽어야 하는 자료 — 쓰지 않는 요청은 보내지 않는다 */
export function sourcesNeeded(prefs: ReminderPrefs): { analyses: boolean; goals: boolean; garden: boolean } {
  return { analyses: prefs.evening || prefs.hungry, goals: prefs.goal, garden: prefs.hungry };
}

/** 예약 식별자가 우리 것인가 — 다른 알림을 건드리지 않는다 */
export function reminderKindOf(id: string): ReminderKind | null {
  const m = /^offlo-(evening|hungry|goal)-/.exec(id);
  return m ? (m[1] as ReminderKind) : null;
}

/** 눌렀을 때 알림 데이터에서 갈 곳을 꺼낸다 — 모양이 이상하면 null (로컬 알림도 데이터를 믿지 않는다 · `routeFor`가 한 번 더 거른다) */
export function linkOf(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const link = (data as Record<string, unknown>).link;
  return typeof link === "string" && link.length <= 200 ? link : null;
}
