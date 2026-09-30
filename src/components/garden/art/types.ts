import type { PetCondition } from "@/logic/garden";
import type { AnimalStatus } from "@/shared/garden-utils";

export interface PetProps {
  /** 캔버스 한 변(px) — 동물은 이 정사각형 안에 그려진다 */
  size: number;
  condition: PetCondition;
  /** 성장 단계 — 크기와 장신구가 달라진다 (알 단계는 Egg가 그린다) */
  stage: AnimalStatus;
  /** 저녁이 넘도록 출출하면 더 초조해한다 (logic/scene.ts `isAnxious`) */
  anxious?: boolean;
  /** false면 정지 포즈 — 스크린샷 · 시스템 "동작 줄이기"에서 쓴다 */
  animate?: boolean;
}

/** 단계별 크기 배율 — 아기는 작고 전설은 크다 */
export const STAGE_SCALE: Record<AnimalStatus, number> = {
  egg: 1,
  baby: 0.74,
  growing: 0.86,
  adult: 0.97,
  enhanced: 1.03,
  legend: 1.08,
};

/** 머리 배율 — 아기는 머리가 크고 자랄수록 비율이 잡힌다 (chibi → 성체) */
export const HEAD_SCALE: Record<AnimalStatus, number> = {
  egg: 1,
  baby: 1.16,
  growing: 1.08,
  adult: 1,
  enhanced: 1,
  legend: 1,
};
