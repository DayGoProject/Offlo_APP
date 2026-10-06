/**
 * 3D 동물 캔버스의 공용 타입 · 화면 배치 — 네이티브(`PetCanvas.tsx`)와 웹(`PetCanvas.web.tsx`)이 같이 쓴다.
 * 배치(카메라 · 뿌리 위치 · 종별 배율)는 쓰는 자리마다 다르다: 확인용 뷰어(`ClayPetView`)와 정원 방(`PetStage`).
 */
import type { PetCondition } from "@/logic/garden";
import type { AnimalStatus, AnimalTypeId } from "@/shared/garden-utils";

import type { HoldAction, PetEvent } from "./PetScene";

export interface CanvasLayout {
  camera: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
  /** 장면 뿌리(발밑) 위치 */
  position: [number, number, number];
  /** 종별 배율 — 토끼는 귀가 커서(높이 3.3) 전설(1.1배 + 왕관)에서 프레임 위로 잘려 더 작게 둔다 */
  fit: Record<AnimalTypeId, number>;
}

/** 확인용 뷰어 (`/preview/clay`) — 358 × 420 상자에 동물과 그릇이 꽉 차게 */
export const VIEWER_LAYOUT: CanvasLayout = {
  camera: [0, 2.6, 9.2],
  lookAt: [0, -0.35, 0],
  fov: 30,
  position: [0, -1.35, 0],
  fit: { cat: 0.95, dog: 0.95, rabbit: 0.84 },
};

/**
 * 정원 방 — 캔버스가 방 폭(360)을 다 덮고 위쪽은 창 아래까지만 (`PetStage`의 `CANVAS_*`). 동물이 러그 위 오른쪽에 선다.
 * 값은 방의 좌표(러그 중심 x≈196 · 발이 닿는 y≈372)에 맞춰 눈으로 조정했다 — 웹 미리보기와 에뮬레이터를 둘 다 본다.
 */
export const ROOM_LAYOUT: CanvasLayout = {
  camera: [0, 2.6, 9.2],
  lookAt: [0, 0.2, 0],
  fov: 30,
  position: [0.2, -1.36, 0],
  fit: { cat: 1.0, dog: 1.0, rabbit: 0.88 },
};

export interface PetCanvasProps {
  type: AnimalTypeId;
  /** 성장 단계 — 알 · 아기 · 성장 중 · 성체 · 강화 성체 · 전설 */
  stage: AnimalStatus;
  condition: PetCondition;
  /** 저녁까지 출출하면 더 초조해한다 */
  anxious?: boolean;
  /** 천천히 좌우로 돌려 3D를 확인한다 */
  spin?: boolean;
  /** 고정 회전각(rad) — 뒷모습 · 3/4 각도 확인용 */
  yaw?: number;
  /** true면 t=0 포즈로 멈춘다 (스크린샷 · 검증용) — 프레임 루프도 필요할 때만 돈다 */
  still?: boolean;
  /** 동작의 한 순간을 붙잡는다 (스크린샷용) */
  hold?: HoldAction;
  /** 값이 바뀔 때마다 밥 먹기를 시작한다 */
  eatSignal?: number;
  /** 이번 밥이 굶주림에서 돌아오는 밥이면 true (`eatSignal`이 바뀔 때의 값 — 햅틱이 더 크다) */
  eatRecovery?: boolean;
  /** 값이 바뀔 때마다 쓰다듬기를 시작한다 */
  petSignal?: number;
  /** 화면 배치 (기본: 확인용 뷰어) */
  layout?: CanvasLayout;
  /** false면 프레임 루프를 멈춘다 — 다른 탭에 가 있는 동안 GPU를 쓰지 않는다 */
  active?: boolean;
  /** 모델을 불러오고 첫 프레임을 그린 직후 한 번 */
  onReady?: () => void;
  /** 밥 먹기 · 부화 · 성장이 시작될 때 (햅틱용) — 프레임 루프가 도는 동안만, 정지 화면에서는 불리지 않는다. 바뀔 때마다 새로 걸리니 안정된 함수를 넘긴다 */
  onEvent?: (event: PetEvent) => void;
  /** true면 캔버스가 직접 탭을 받는다 (뷰어). 정원은 스크롤과 다투지 않게 false — 위에 Pressable을 얹는다 */
  interactive?: boolean;
}
