/**
 * 성장 단계(알 · 아기 · 성장 중 · 성체 · 강화 성체 · 전설)별 3D 외형 — 순수 데이터.
 * 모델은 하나이고 크기 · 머리 비율 · 눈 크기 · 장신구(스카프 · 왕관 · 오라)로 단계를 나눈다 (모델 18벌을 따로 만들지 않는다).
 * 아기는 머리가 크고 눈이 커서 귀엽고, 자랄수록 비율이 잡히며, 강화 성체는 스카프를, 전설은 왕관과 오라를 두른다.
 */
import type { AnimalStatus, AnimalTypeId } from "@/shared/garden-utils";

export interface StageLook {
  /** 전체 크기 */
  scale: number;
  /** 머리 배율 — 아기일수록 크다 (chibi → 성체) */
  headScale: number;
  /** 눈 배율 */
  eyeScale: number;
  scarf: boolean;
  crown: boolean;
  aura: boolean;
}

export const STAGE_LOOK: Record<AnimalStatus, StageLook> = {
  egg: { scale: 1, headScale: 1, eyeScale: 1, scarf: false, crown: false, aura: false },
  baby: { scale: 0.66, headScale: 1.26, eyeScale: 1.12, scarf: false, crown: false, aura: false },
  growing: { scale: 0.82, headScale: 1.12, eyeScale: 1.05, scarf: false, crown: false, aura: false },
  adult: { scale: 1, headScale: 1, eyeScale: 1, scarf: false, crown: false, aura: false },
  enhanced: { scale: 1.04, headScale: 1, eyeScale: 1, scarf: true, crown: false, aura: false },
  legend: { scale: 1.1, headScale: 1, eyeScale: 1, scarf: true, crown: true, aura: true },
};

/**
 * 왕관이 앉는 자리 — **모델 공간**(발바닥 y=0)의 중심 · 반지름 · 앞으로 숙임(rad). 머리 뼈대에 붙일 때 `attach`가 뼈대 기준으로 바꿔 준다.
 * 고양이 · 강아지는 두 귀 사이 정수리, 토끼는 귀가 붙은 자리가 좁아 이마 쪽에 비스듬히 얹는다.
 * 값은 `scripts/sculpt/pets.html`의 머리 타원체(정수리 높이)에서 잰다 — 모델을 다시 조각하면 여기도 확인한다.
 */
export const CROWN_SPOT: Record<AnimalTypeId, { y: number; z: number; r: number; tilt: number }> = {
  cat: { y: 2.58, z: 0.16, r: 0.42, tilt: 0.06 },
  dog: { y: 2.5, z: 0.18, r: 0.46, tilt: 0.06 },
  rabbit: { y: 2.4, z: 0.5, r: 0.27, tilt: 0.44 },
};

/** 알 무늬 색 — 고른 동물의 무늬 색이 살짝 비친다 (SVG 알과 같은 값) */
export const EGG_SPECKLE: Record<AnimalTypeId, string> = {
  cat: "#D9884A",
  dog: "#B98A4C",
  rabbit: "#B7A6DA",
};
