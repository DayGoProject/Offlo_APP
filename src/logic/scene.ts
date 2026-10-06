/**
 * 정원 장면 계산 — 시간대별 창밖 하늘 · 동물 말풍선 대사. 순수 함수만 둔다 (런타임 import 없음) — Node로 검증한다.
 *
 * 시계는 **KST**다 (logic/garden.ts와 같다) — 서버의 "오늘"과 같은 시계로 하늘이 바뀌어야
 * 자정을 넘기는 순간 "새 날이 시작됐다"는 것이 장면에서도 느껴진다.
 */
import type { PetCondition } from "@/logic/pet-condition";
import type { AnimalTypeId } from "@/shared/garden-utils";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type DayPart = "dawn" | "day" | "dusk" | "night";

/** 시각(ms) → KST 시(0~23) */
export function kstHour(now: number): number {
  return new Date(now + KST_OFFSET_MS).getUTCHours();
}

/** 새벽 5~7 · 낮 7~17 · 저녁 17~20 · 밤 20~5 */
export function dayPartOf(now: number): DayPart {
  const h = kstHour(now);
  if (h >= 5 && h < 7) return "dawn";
  if (h >= 7 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

/** 출출한 채로 저녁(18시)이 넘으면 더 초조해한다 — 동작 빈도를 올리는 신호 */
export function isAnxious(condition: PetCondition, now: number): boolean {
  return condition === "peckish" && kstHour(now) >= 18;
}

/* ── 말풍선 대사 ────────────────────────────────────────────── */

type Lines = readonly string[];

/**
 * 조건 × 동물별 혼잣말. 배고픔 대사는 동물마다 다르게 — "진짜 그 동물이 말하는" 느낌이 게임의 정이다.
 * 죄책감을 주는 말투는 쓰지 않는다 (기둥 4 "다정하다") — 조르되 원망하지 않는다.
 */
const LINES: Record<Exclude<PetCondition, "none">, Record<AnimalTypeId, Lines>> = {
  egg: {
    cat: ["톡… 톡톡…", "안에서 뭔가 꿈틀거려요", "곧 만날 수 있을까요?"],
    dog: ["콩닥콩닥…", "안에서 꼬리가 들썩여요", "얼른 만나고 싶어요!"],
    rabbit: ["오물오물…", "안에서 귀가 움찔해요", "조금만 더 기다려 주세요"],
  },
  fed: {
    cat: ["그르릉… 배불러요", "오늘도 고마워요", "이제 낮잠 자야지…"],
    dog: ["왈! 배불러요!", "꼬리가 멈추질 않아요", "오늘 최고예요!"],
    rabbit: ["냠냠, 잘 먹었어요", "귀가 사르르 녹아요", "오늘도 든든해요"],
  },
  peckish: {
    cat: ["야옹… 밥그릇이 비었어요", "오늘 밥은 언제 와요?", "…힐끔"],
    dog: ["낑낑… 오늘 밥은요?", "빈 그릇 보고 있어요", "기다리는 중이에요!"],
    rabbit: ["쿵쿵! 당근 주세요", "밥 시간 아닌가요?", "코가 씰룩씰룩해요"],
  },
  starving: {
    cat: ["야…옹…", "배에서 소리가 나요", "기운이 없어요…"],
    dog: ["끄응…", "그래도 기다릴게요", "꼬르륵…"],
    rabbit: ["꾸…웅…", "당근 꿈을 꿨어요", "귀가 자꾸 처져요…"],
  },
};

/** 조건 · 동물에 맞는 대사 목록 — 동물을 고르지 않았으면 빈 배열 */
export function speechLines(condition: PetCondition, type: AnimalTypeId | null): Lines {
  if (condition === "none" || !type) return [];
  return LINES[condition][type];
}

/** 대사를 하나씩 돌려 준다 — 같은 대사가 연달아 나오지 않게 순환 */
export function pickLine(lines: Lines, turn: number): string | null {
  if (lines.length === 0) return null;
  return lines[((turn % lines.length) + lines.length) % lines.length];
}
