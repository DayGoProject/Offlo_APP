/**
 * 종에 맞는 동물 리그를 고른다 — 정원 장면(PetStage)과 미리보기(pet-art)가 같이 쓴다.
 * 알 단계는 종과 무관하게 Egg가 그린다 (무늬 색만 종을 따른다) — 호출하는 쪽이 고른다.
 */
import type { AnimalTypeId } from "@/shared/garden-utils";

import Cat from "./Cat";
import Dog from "./Dog";
import Rabbit from "./Rabbit";
import type { PetProps } from "./types";

export default function Pet({ type, ...props }: PetProps & { type: AnimalTypeId }) {
  switch (type) {
    case "cat":
      return <Cat {...props} />;
    case "dog":
      return <Dog {...props} />;
    case "rabbit":
      return <Rabbit {...props} />;
  }
}
