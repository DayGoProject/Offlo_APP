/**
 * 리그 레이어 — 동물의 한 부위. **정사각 캔버스(240 단위) 전체를 덮는** 투명한 뷰라서 모든 부위가 같은 좌표계를 쓰고,
 * 회전 · 확대의 기준점(origin)도 캔버스 좌표로 적는다. 부위를 중첩(머리 안의 귀 · 눈)하면 변환이 자연스럽게 겹쳐진다.
 *
 *   <Group style={headStyle} origin={[120, 140]}>       ← 움직이는 묶음 (그림 없음)
 *     <Layer style={earStyle} origin={[86, 66]}>...</Layer>   ← 그림이 있는 부위 (SVG)
 *   </Group>
 *
 * 뷰 + SVG 조합인 이유: SVG 요소에 Reanimated `animatedProps`로 변환을 주는 것보다 RN 스타일 변환이
 * 안드로이드 · iOS · 웹에서 똑같이 동작한다 (특히 `transformOrigin`).
 */
import { useId, type ComponentProps, type ReactNode } from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import Svg from "react-native-svg";

/** 캔버스 한 변 (단위) — 모든 좌표는 이 안에서 적는다 */
export const CANVAS = 240;

interface BaseProps {
  /** 화면에 그려질 한 변(px) */
  size: number;
  /** 변환 기준점 — 캔버스 좌표 [x, y] */
  origin?: readonly [number, number];
  /** `useAnimatedStyle` 결과 — Animated.View가 받는 스타일 그대로 */
  style?: ComponentProps<typeof Animated.View>["style"];
  children?: ReactNode;
}

/** 소수 둘째 자리까지 — 부동소수 오차(60.199999999999996)를 기준점에 실어 보내지 않는다 */
const round2 = (n: number) => Math.round(n * 100) / 100;

function frame(size: number, origin?: readonly [number, number]): ViewStyle {
  const s = size / CANVAS;
  return {
    position: "absolute",
    left: 0,
    top: 0,
    width: size,
    height: size,
    // 문자열("71.39999999999999px …")이 아니라 숫자 배열로 준다 — 안드로이드에서 문자열 기준점은 크기에 따라
    // (예: 캔버스 168 = s 0.7) 변환이 걸린 레이어를 통째로 지웠다. 배열은 같은 자리에서 정상이다
    ...(origin ? { transformOrigin: [round2(origin[0] * s), round2(origin[1] * s), 0] } : null),
  };
}

/** 움직이는 묶음 — 그림 없이 자식 부위들을 함께 변환한다 */
export function Group({ size, origin, style, children }: BaseProps) {
  return (
    <Animated.View pointerEvents="none" style={[frame(size, origin), style]}>
      {children}
    </Animated.View>
  );
}

/** 그림이 있는 부위 — 캔버스 좌표로 그린 SVG를 담는다 */
export function Layer({ size, origin, style, children }: BaseProps) {
  return (
    <Animated.View pointerEvents="none" style={[frame(size, origin), style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${CANVAS} ${CANVAS}`} style={StyleSheet.absoluteFill}>
        {children}
      </Svg>
    </Animated.View>
  );
}

/** SVG 그라데이션 id — 같은 화면에 동물이 여러 마리여도 겹치지 않게 (`useId`의 `:`는 url(#…)에서 깨진다) */
export function useGradId(name: string): string {
  return `${name}${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}
