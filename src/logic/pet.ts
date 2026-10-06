/**
 * 쓰다듬기 · 친밀도 계산 (M6 6-4) — 순수 함수만 둔다 (런타임 import는 `@/shared/*` 뿐) — Node로 검증한다 (scripts/verify-M6-logic.mjs).
 *
 * 규칙은 서버(웹 `POST /api/garden/pet`)와 **같은 함수**(`applyPetTaps` · 공유 코드 `garden-utils`)를 쓴다 —
 * 앱이 화면에 먼저 반영하는 값과 서버가 인정하는 값이 같은 계산이라야 나중에 응답이 와도 숫자가 튀지 않는다.
 *
 * 흐름: 탭 → 화면에 즉시 반영(pending) → 잠시 모아 한 번에 전송(inflight) → 응답이 서버 값(server)을 갱신.
 *  · 서버가 진실이다 — 응답 · Firestore 읽기는 `server`를 덮어쓴다. 보낸 뒤 실패하면 그 몫은 버리고 서버 값으로 되돌린다
 *    (두 번 보내면 두 번 반영되는 요청이라 자동 재전송하지 않는다).
 *  · 하루 상한을 넘은 탭은 세지도 보내지도 않는다 — 화면 효과만 있다.
 */
import type { PetCondition } from "@/logic/garden";
import {
  PET_DAILY_CAP,
  affectionRatio,
  applyPetTaps,
  getAffectionLevel,
  nextAffectionLevel,
  normalizePet,
  type AnimalTypeId,
  type PetRecord,
} from "@/shared/garden-utils";

export interface AffectionState {
  /** 서버가 마지막으로 알려 준 기록 (Firestore 읽기 · 전송 응답) */
  server: PetRecord;
  /** 지금 서버로 가는 중인 횟수 */
  inflight: number;
  /** 아직 보내지 않고 모아 둔 횟수 */
  pending: number;
}

/** 화면에 그리는 친밀도 한 장 */
export interface AffectionView {
  /** 오늘 인정된(될) 횟수 */
  today: number;
  cap: number;
  /** 누적 = 친밀도 */
  total: number;
  level: { level: number; name: string };
  next: { level: number; name: string; minTotal: number } | null;
  /** 지금 레벨 안에서 다음 레벨까지의 진행률 0~1 (마지막 레벨은 1) */
  ratio: number;
  /** 다음 레벨까지 남은 횟수 (마지막 레벨은 0) */
  remainToNext: number;
  /** 오늘 상한을 채웠다 */
  capped: boolean;
}

export interface TapResult {
  /** 이번 탭이 친밀도로 인정됐다 (false면 오늘 상한을 이미 채웠다 — 화면 효과만) */
  counted: boolean;
  /** 이번 탭으로 레벨이 올랐다 */
  levelUp: boolean;
  /** 이번 탭으로 오늘 상한에 닿았다 (그 전까지는 아니었다) */
  reachedCap: boolean;
  view: AffectionView;
}

export function initAffection(pet: PetRecord | null | undefined): AffectionState {
  return { server: normalizePet(pet), inflight: 0, pending: 0 };
}

/** 서버 기록 위에 아직 반영되지 않은 몫(보내는 중 + 모아 둔 것)을 올린 "지금 보여 줄" 기록 */
export function shownRecord(state: AffectionState, todayKey: string): PetRecord {
  return applyPetTaps(state.server, todayKey, state.inflight + state.pending).next;
}

export function affectionView(state: AffectionState, todayKey: string): AffectionView {
  return viewOf(shownRecord(state, todayKey), todayKey);
}

function viewOf(record: PetRecord, todayKey: string): AffectionView {
  const level = getAffectionLevel(record.total);
  const next = nextAffectionLevel(level);
  const today = record.date === todayKey ? record.today : 0;
  return {
    today,
    cap: PET_DAILY_CAP,
    total: record.total,
    level: { level: level.level, name: level.name },
    next: next ? { level: next.level, name: next.name, minTotal: next.minTotal } : null,
    ratio: affectionRatio(record.total),
    remainToNext: next ? Math.max(0, next.minTotal - record.total) : 0,
    capped: today >= PET_DAILY_CAP,
  };
}

/** 쓰다듬기 한 번. 오늘 상한을 이미 채웠다면 상태를 바꾸지 않고 `counted: false` */
export function tapPet(state: AffectionState, todayKey: string): { state: AffectionState; result: TapResult } {
  const before = shownRecord(state, todayKey);
  const { next, accepted } = applyPetTaps(before, todayKey, 1);
  const beforeView = viewOf(before, todayKey);
  if (accepted === 0) {
    return { state, result: { counted: false, levelUp: false, reachedCap: false, view: beforeView } };
  }
  const view = viewOf(next, todayKey);
  return {
    state: { ...state, pending: state.pending + 1 },
    result: {
      counted: true,
      levelUp: view.level.level > beforeView.level.level,
      reachedCap: view.capped && !beforeView.capped,
      view,
    },
  };
}

/** 모아 둔 몫을 보낸다 — 이미 보내는 중이거나 보낼 것이 없으면 `count: 0` (한 번에 하나만 보내 순서를 지킨다) */
export function beginFlush(state: AffectionState): { state: AffectionState; count: number } {
  if (state.inflight > 0 || state.pending === 0) return { state, count: 0 };
  return { state: { ...state, inflight: state.pending, pending: 0 }, count: state.pending };
}

/** 전송 응답 — 서버가 알려 준 기록이 진실이다 (다른 기기가 먼저 올렸거나 상한에 걸려 덜 인정됐어도 여기서 맞는다) */
export function flushDone(state: AffectionState, response: { date: string | null; today: number; total: number }): AffectionState {
  return { ...state, server: normalizePet(response), inflight: 0 };
}

/** 전송 실패 — 보낸 몫은 버린다 (서버에 닿았는지 알 수 없어 다시 보내면 두 번 셀 수 있다). 모아 둔 몫은 그대로 */
export function flushFailed(state: AffectionState): AffectionState {
  return { ...state, inflight: 0 };
}

/** 화면이 새로 읽은 서버 기록으로 맞춘다 (탭에 돌아왔을 때 · 동물을 바꿨을 때) */
export function syncServer(state: AffectionState, pet: PetRecord | null | undefined): AffectionState {
  return { ...state, server: normalizePet(pet) };
}

export function samePet(a: PetRecord | null | undefined, b: PetRecord | null | undefined): boolean {
  const x = normalizePet(a);
  const y = normalizePet(b);
  return x.date === y.date && x.today === y.today && x.total === y.total;
}

/* ── 반응 대사 ─────────────────────────────────────────────── */

type Lines = readonly string[];
type ReactionKind = "pet" | "capped";

/**
 * 쓰다듬었을 때 동물이 하는 말. 상태 × 동물별로 — 배고파도 원망하지 않고 쓰다듬는 손을 반긴다 (기둥 4 "다정하다").
 */
const PET_LINES: Record<Exclude<PetCondition, "none">, Record<AnimalTypeId, Lines>> = {
  egg: {
    cat: ["톡!", "안에서 대답했어요", "톡톡, 거기 있어요?"],
    dog: ["콩콩!", "안에서 꼬리가 들썩!", "두근두근!"],
    rabbit: ["쿵!", "안에서 귀가 움찔!", "콩닥콩닥!"],
  },
  fed: {
    cat: ["그르릉… 좋아요", "거기, 거기가 좋아요", "골골골…"],
    dog: ["왈왈! 좋아요!", "꼬리가 멈추질 않아요!", "더 더 더!"],
    rabbit: ["꾹꾹… 좋아요", "귀가 사르르 녹아요", "코가 간질간질해요"],
  },
  peckish: {
    cat: ["야옹… 그래도 좋아요", "골골… 고마워요", "…손이 따뜻해요"],
    dog: ["낑… 그래도 좋아요", "꼬리가 저절로…", "손이 따뜻해요!"],
    rabbit: ["쿵… 좋아요", "코가 씰룩씰룩", "조금만 더요…"],
  },
  starving: {
    cat: ["야…옹…", "…따뜻해요", "…고마워요"],
    dog: ["끄응… 고마워요", "…따뜻해요", "…좋아요"],
    rabbit: ["꾸…웅…", "…따뜻해요", "…고마워요"],
  },
};

/** 오늘 상한(5번)을 채운 뒤의 말 — 졸라 대지 않고 내일을 기약한다 */
const CAPPED_LINES: Record<Exclude<PetCondition, "none">, Lines> = {
  egg: ["오늘은 쉴게요… 쿨쿨", "내일 또 톡톡해요"],
  fed: ["오늘은 실컷 만졌어요", "내일 또 놀아요", "마음이 배불러요"],
  peckish: ["오늘은 충분해요", "내일 또 만나요"],
  starving: ["충분해요… 고마워요", "내일 또 만나요"],
};

/** 쓰다듬은 횟수로 대사를 돌려 가며 고른다 — 같은 말이 연달아 나오지 않게 */
export function reactionLine(
  condition: PetCondition,
  type: AnimalTypeId | null,
  kind: ReactionKind,
  turn: number,
): string | null {
  if (condition === "none" || !type) return null;
  const lines = kind === "capped" ? CAPPED_LINES[condition] : PET_LINES[condition][type];
  return lines[((turn % lines.length) + lines.length) % lines.length];
}

/** 레벨이 오른 순간의 말 — 친밀도 이름을 알려 준다 */
export function levelUpLine(view: AffectionView): string {
  return `친밀도 Lv.${view.level.level} · ${view.level.name}!`;
}
