/**
 * 오늘의 미션 (M6 6-5) — 서버에 이미 있는 값에서 **계산만** 한다. 새 서버 판정 · 새 저장 값이 없다.
 * 순수 함수만 둔다 (런타임 import는 `@/logic/*` · `@/shared/*` 뿐) — Node로 검증한다 (scripts/verify-M6-logic.mjs).
 *
 * 미션 셋 (docs/garden-game-design.md 2장)
 *  · 밥 주기      — 오늘(KST) 일간 분석을 올렸다 = 동물 상태 `fed` (`lastAnalysisDate`)
 *  · 쓰다듬기 N번 — 오늘 인정된 쓰다듬기(`pet.today`)가 목표(3번)에 닿았다. 하루 상한(5번) 안이라 늘 채울 수 있다
 *  · 주간 분석    — 이번 주(KST 월~일) 주간 분석을 받았다. 받으려면 이번 주 일간 분석 7개가 필요하다 (서버도 7개를 요구한다)
 * "오늘 목표 완료"는 뺐다 — 목표 API에 완료 시각이 없어 오늘 끝냈는지 알 수 없다.
 *
 * 보상은 식물 경험치가 아니라 **연출**이다 (경험치는 서버의 분석 · 목표 후처리만 올린다). 칭호 같은 남는 보상은 서버 저장이 있어야 해서 이 단계에 없다.
 * 앞의 둘은 "오늘" 미션이라 날이 바뀌면(KST) 저절로 다시 비어 있다 — 따로 저장하는 것이 없다.
 */
import { WEEKLY_THRESHOLD, thisWeekDaily, thisWeekWeekly, type AnalysisRecords } from "@/logic/analysis";
import type { PetCondition } from "@/logic/pet-condition";
import type { AnimalTypeId } from "@/shared/garden-utils";

/** 쓰다듬기 미션 목표 — 하루 상한(`PET_DAILY_CAP` 5)보다 작아 하루에 늘 채울 수 있다 */
export const PET_MISSION_TARGET = 3;

export type MissionId = "feed" | "pet" | "weekly";

export interface Mission {
  id: MissionId;
  /** 오늘 미션인가 이번 주 미션인가 */
  period: "today" | "week";
  title: string;
  done: boolean;
  /** 진행 — 숫자로 셀 수 없으면 null */
  progress: { value: number; target: number } | null;
  /** 한 줄 안내 (한국어) */
  hint: string;
  /** 누르면 분석 탭으로 가는 미션인가 (밥 · 주간 분석을 받을 수 있을 때) */
  goesToAnalysis: boolean;
}

export interface MissionBoard {
  missions: Mission[];
  /** 오늘 미션(밥 · 쓰다듬기) 중 끝낸 개수와 전체 */
  todayDone: number;
  todayTotal: number;
  allTodayDone: boolean;
}

/** 이번 주 기록을 아직 모르는 이유 — 불러오는 중이거나 실패했다 */
export type WeekStatus = "loading" | "ready" | "error";

export interface MissionInput {
  condition: PetCondition;
  /** 오늘 인정된 쓰다듬기 횟수 (`AffectionView.today`) */
  petToday: number;
  /** 분석 목록 — 불러오지 못했으면 null */
  records: AnalysisRecords | null;
  weekStatus: WeekStatus;
  now: number;
}

export function missionBoard({ condition, petToday, records, weekStatus, now }: MissionInput): MissionBoard {
  const fed = condition === "fed";
  const feed: Mission = {
    id: "feed",
    period: "today",
    title: condition === "egg" ? "알 부화시키기" : "밥 주기",
    done: fed,
    progress: null,
    hint: fed
      ? "오늘 분석을 마쳤어요."
      : condition === "egg"
        ? "첫 분석을 올리면 알에서 깨어나요."
        : "오늘 분석을 올리면 밥을 먹어요.",
    goesToAnalysis: !fed,
  };

  const petValue = Number.isFinite(petToday) ? Math.min(Math.max(0, Math.floor(petToday)), PET_MISSION_TARGET) : 0;
  const pet: Mission = {
    id: "pet",
    period: "today",
    title: `쓰다듬기 ${PET_MISSION_TARGET}번`,
    done: petValue >= PET_MISSION_TARGET,
    progress: { value: petValue, target: PET_MISSION_TARGET },
    hint: petValue >= PET_MISSION_TARGET ? "오늘은 충분히 쓰다듬었어요." : "동물을 톡 누르거나 쓱쓱 문질러 주세요.",
    goesToAnalysis: false,
  };

  const weekly = weeklyMission(records, weekStatus, now);

  const todayList = [feed, pet];
  const todayDone = todayList.filter((m) => m.done).length;
  return {
    missions: [feed, pet, weekly],
    todayDone,
    todayTotal: todayList.length,
    allTodayDone: todayDone === todayList.length,
  };
}

function weeklyMission(records: AnalysisRecords | null, status: WeekStatus, now: number): Mission {
  const base = { id: "weekly", period: "week", title: "이번 주 주간 분석 받기" } as const;
  if (!records) {
    return {
      ...base,
      done: false,
      progress: null,
      hint: status === "error" ? "이번 주 기록을 불러오지 못했어요." : "이번 주 기록을 확인하고 있어요.",
      goesToAnalysis: false,
    };
  }
  if (thisWeekWeekly(records.weekly, now)) {
    return { ...base, done: true, progress: null, hint: "이번 주 주간 분석을 받았어요.", goesToAnalysis: false };
  }
  const have = Math.min(thisWeekDaily(records.daily, now).length, WEEKLY_THRESHOLD);
  const ready = have >= WEEKLY_THRESHOLD;
  return {
    ...base,
    done: false,
    progress: { value: have, target: WEEKLY_THRESHOLD },
    hint: ready ? "일간 분석이 모였어요. 주간 분석을 받아 보세요." : `이번 주 일간 분석이 ${WEEKLY_THRESHOLD}개 모이면 받을 수 있어요.`,
    goesToAnalysis: ready,
  };
}

/**
 * 쓰다듬기 한 번이 오늘 미션을 막 채웠는가 — 인정된 탭으로 오늘 횟수가 **정확히** 목표가 됐을 때만 (한 번만 난다).
 * `todayAfter`는 그 탭 뒤의 오늘 횟수.
 */
export function petMissionJustDone(counted: boolean, todayAfter: number): boolean {
  return counted && todayAfter === PET_MISSION_TARGET;
}

/* ── 연출 문구 ─────────────────────────────────────────────── */

type Lines = Record<AnimalTypeId, string>;

/** 동물이 하는 한마디 — 배고파도 원망하지 않고 기뻐한다 (기둥 4 "다정하다"). 부화 · 성장은 이름 카드가 말한다 */
const SAY: Record<"eat" | "recover", Lines> = {
  eat: { cat: "냠냠… 맛있어요", dog: "왈! 냠냠!", rabbit: "오물오물… 맛있어요" },
  recover: { cat: "야옹! 다시 힘이 나요", dog: "왈왈! 기운이 나요!", rabbit: "쿵쿵! 다시 기운이 나요" },
};

export function celebrationLine(kind: "eat" | "recover", type: AnimalTypeId): string {
  return SAY[kind][type];
}

/** 쓰다듬기 미션을 채운 순간의 말 — 밥 미션까지 끝났으면 오늘 미션이 모두 끝난 것이다 */
export function missionDoneLine(allTodayDone: boolean): string {
  return allTodayDone ? "오늘 미션을 모두 끝냈어요!" : "쓰다듬기 미션 완료!";
}

/** 이름 카드 — 부화 · 성장 단계 상승 (조사가 붙지 않는 모양으로 쓴다: 단계 이름은 받침이 제각각이라) */
export function nameCard(
  kind: "hatch" | "stageUp",
  stageName: string,
  typeName: string,
): { title: string; name: string } {
  return kind === "hatch"
    ? { title: "알에서 깨어났어요", name: `${stageName} ${typeName}` }
    : { title: "단계가 올랐어요", name: stageName };
}
