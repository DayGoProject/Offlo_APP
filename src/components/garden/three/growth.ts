/**
 * 성장 단계(알 · 아기 · 성장 중 · 성체 · 강화 성체 · 전설)별 3D 외형 — 순수 데이터.
 * 모델은 하나이고 크기 · 머리 비율 · 눈 크기 · 장신구(스카프 · 왕관 · 오라)로 단계를 나눈다 (모델 18벌을 따로 만들지 않는다).
 * 아기는 머리가 크고 눈이 커서 귀엽고, 자랄수록 비율이 잡히며, 강화 성체는 스카프를, 전설은 왕관과 오라를 두른다.
 */
import type { AnimalStatus, AnimalTypeId } from "@/shared/garden-utils";

import { ADULT_LOOK, type Look } from "./rig";

export interface StageLook extends Look {
  /** 전체 크기 */
  scale: number;
  scarf: boolean;
  crown: boolean;
  aura: boolean;
}

/**
 * 단계별 체형 — 아기는 단지 "작은 성체"가 아니라 비율이 다르다: 머리가 크고(1.3) 몸이 짧고 통통하고(높이 0.8 · 폭 1.15) 다리 · 꼬리가 짧고 귀는 머리에 비해 작다.
 * 자라면서 그 비율이 성체로 풀린다 (단계가 바뀔 때 `PetScene`이 부드럽게 보간한다).
 */
export const STAGE_LOOK: Record<AnimalStatus, StageLook> = {
  egg: { ...ADULT_LOOK, scale: 1, scarf: false, crown: false, aura: false },
  baby: { scale: 0.7, headScale: 1.32, eyeScale: 1.12, body: [1.15, 0.8, 1.1], ear: 0.95, tail: 0.65, scarf: false, crown: false, aura: false },
  growing: { scale: 0.84, headScale: 1.14, eyeScale: 1.05, body: [1.07, 0.92, 1.05], ear: 1, tail: 0.85, scarf: false, crown: false, aura: false },
  adult: { ...ADULT_LOOK, scale: 1, scarf: false, crown: false, aura: false },
  enhanced: { ...ADULT_LOOK, scale: 1.04, scarf: true, crown: false, aura: false },
  legend: { ...ADULT_LOOK, scale: 1.1, scarf: true, crown: true, aura: true },
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
