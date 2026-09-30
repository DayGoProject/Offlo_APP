/**
 * 정원 동물 3D 모델 — `scripts/sculpt/build-pets.mjs`가 만든 GLB. `require`는 정적이어야 Metro가 번들한다.
 * 타입은 string으로 맞춘다 (R3F 로더의 배열 오버로드와 헷갈리지 않게 — 네이티브는 실제로 에셋 모듈 번호를 받는다).
 */
import type { AnimalTypeId } from "@/shared/garden-utils";

export const PET_MODELS: Record<AnimalTypeId, string> = {
  cat: require("../../../../assets/models/pets/cat.glb"),
  dog: require("../../../../assets/models/pets/dog.glb"),
  rabbit: require("../../../../assets/models/pets/rabbit.glb"),
};
