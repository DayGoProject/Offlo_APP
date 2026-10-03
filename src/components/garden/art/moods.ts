/**
 * 동물 상태별 몸짓 값 — 순수 데이터. 각 종(고양이 · 강아지 · 토끼)은 같은 값을 자기 몸에 맞게 쓴다.
 * (docs/garden-game-design.md 3장 "동물 상태" — 상태는 글이 아니라 몸짓으로 읽힌다)
 *
 *   fed       배부름 — 꼬리를 힘차게 흔들고 가끔 신나서 통 튄다
 *   peckish   출출 — 눈이 커지고 빈 그릇을 보며 조바심 (저녁엔 더 빨라진다)
 *   starving  굶주림 — 귀 · 꼬리가 처지고 눈이 반쯤 감기고 살짝 떨린다. 죽지 않는다
 */
import type { PetCondition } from "@/logic/garden";

export type Mouth = "smile" | "open" | "flat" | "frown";

export interface Mood {
  /** 숨쉬기 한 번(ms) · 몸통이 늘어나는 정도 */
  breathMs: number;
  breathAmp: number;
  /** 머리가 숨에 맞춰 오르내리는 폭 (캔버스 단위) */
  headBob: number;
  /** 꼬리 흔들림 각도(도) · 한 번 왕복(ms) · 기본 처짐 각도 */
  tailAmp: number;
  tailMs: number;
  tailBase: number;
  /** 귀가 바깥으로 처진 각도(도) — 0이면 쫑긋 */
  earDroop: number;
  /** 귀를 가끔 쫑긋거리는가 */
  earTwitch: boolean;
  /** 눈꺼풀이 덮는 비율 0~1 (0 = 활짝) */
  lid: number;
  /** 눈 크기 배율 */
  eyeScale: number;
  /** 떨림 폭 (캔버스 단위, 0이면 없음) */
  tremble: number;
  /** 신나서 폴짝 — 주기(ms), 0이면 없음 */
  hopEveryMs: number;
  mouth: Mouth;
  /** 눈물 방울 */
  tear: boolean;
  /** 머리가 앞으로 숙는 정도 (캔버스 단위) */
  slump: number;
  /** 시선 (캔버스 단위) — 출출하면 빈 그릇 쪽(아래 · 옆)을 본다 */
  gazeX: number;
  gazeY: number;
  /** 깜빡임 속도 배율 */
  blinkSpeed: number;
  /** (3D) 앞다리가 힘없이 뒤로 처지는 각도(rad) — 굶주림 */
  legSag: number;
  /** (3D) 앞발 하나를 들고 톡톡 조르는 정도 0~1 — 출출 */
  beg: number;
  /** (3D) 앉아서 체중을 옮기는 앞다리 흔들림(rad) */
  shift: number;
}

const BASE: Mood = {
  breathMs: 2800,
  breathAmp: 0.025,
  headBob: 1.2,
  tailAmp: 10,
  tailMs: 1400,
  tailBase: 0,
  earDroop: 0,
  earTwitch: true,
  lid: 0,
  eyeScale: 1,
  tremble: 0,
  hopEveryMs: 0,
  mouth: "smile",
  tear: false,
  slump: 0,
  gazeX: 0,
  gazeY: 0,
  blinkSpeed: 1,
  legSag: 0,
  beg: 0,
  shift: 0.035,
};

export function moodFor(condition: PetCondition, anxious = false): Mood {
  switch (condition) {
    case "fed":
      return { ...BASE, breathMs: 2800, tailAmp: 18, tailMs: 640, hopEveryMs: 6200, mouth: "smile" };
    case "peckish":
      return {
        ...BASE,
        breathMs: anxious ? 1900 : 2400,
        breathAmp: 0.03,
        tailAmp: anxious ? 12 : 7,
        tailMs: anxious ? 900 : 1500,
        eyeScale: 1.1,
        mouth: "flat",
        gazeX: -3,
        gazeY: 3.5,
        blinkSpeed: anxious ? 1.5 : 1,
        beg: anxious ? 1.1 : 0.9,
      };
    case "starving":
      return {
        ...BASE,
        breathMs: 4200,
        breathAmp: 0.018,
        headBob: 0.6,
        tailAmp: 2.5,
        tailMs: 3200,
        tailBase: -16,
        earDroop: 24,
        earTwitch: false,
        lid: 0.45,
        eyeScale: 0.96,
        tremble: 0.7,
        mouth: "frown",
        tear: true,
        slump: 6,
        gazeY: 4,
        blinkSpeed: 0.6,
        legSag: 0.14,
        shift: 0.012,
      };
    default:
      // egg · none — 몸이 없다. 알은 자기 흔들림을 따로 쓴다
      return { ...BASE };
  }
}
