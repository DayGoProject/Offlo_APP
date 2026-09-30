/**
 * 성장 단계 목록용 작은 식물 렌더 — 웹 `PLANT_LEVELS[].thumb`(96px) 대응.
 * 512px 원본 7장을 목록에 한꺼번에 디코딩하지 않게 `assets/plants/thumb/`의 작은 파일을 쓴다.
 */
import { Image } from "expo-image";

import type { PlantLevel } from "@/shared/garden-utils";

const THUMBS: Record<PlantLevel["level"], number> = {
  1: require("../../../assets/plants/thumb/plant-1-seed.avif"),
  2: require("../../../assets/plants/thumb/plant-2-sprout.avif"),
  3: require("../../../assets/plants/thumb/plant-3-seedling.avif"),
  4: require("../../../assets/plants/thumb/plant-4-bud.avif"),
  5: require("../../../assets/plants/thumb/plant-5-bloom.avif"),
  6: require("../../../assets/plants/thumb/plant-6-fruit.avif"),
  7: require("../../../assets/plants/thumb/plant-7-tree.avif"),
};

export default function PlantThumb({
  level,
  size,
  opacity = 1,
}: {
  level: PlantLevel["level"];
  size: number;
  opacity?: number;
}) {
  return <Image source={THUMBS[level]} style={{ width: size, height: size, opacity }} contentFit="contain" accessible={false} />;
}
