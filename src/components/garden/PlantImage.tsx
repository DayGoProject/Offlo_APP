/**
 * 레벨에 맞는 유리 식물 렌더 — 웹 `components/garden/PlantImage.tsx` 이식.
 *
 * 이미지는 웹 `public/plants/`의 **투명 배경 AVIF**를 그대로 복사해 앱에 넣었다(`assets/plants/`).
 * 어떤 면 위에 얹어도 사각형 경계가 생기지 않는다. 경로는 공유 코드(garden-utils)의 레벨에 맞춰 여기서 고른다.
 */
import { Image } from "expo-image";

import { getPlantLevel, type PlantLevel } from "@/shared/garden-utils";

const IMAGES: Record<PlantLevel["level"], number> = {
  1: require("../../../assets/plants/plant-1-seed.avif"),
  2: require("../../../assets/plants/plant-2-sprout.avif"),
  3: require("../../../assets/plants/plant-3-seedling.avif"),
  4: require("../../../assets/plants/plant-4-bud.avif"),
  5: require("../../../assets/plants/plant-5-bloom.avif"),
  6: require("../../../assets/plants/plant-6-fruit.avif"),
  7: require("../../../assets/plants/plant-7-tree.avif"),
};

export default function PlantImage({ totalMinutes, size }: { totalMinutes: number; size: number }) {
  const level = getPlantLevel(totalMinutes);

  return (
    <Image
      testID="plant-image"
      source={IMAGES[level.level]}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessibilityLabel={`${level.name} 단계의 반려 식물`}
    />
  );
}
