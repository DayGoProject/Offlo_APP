/**
 * 알 — 동물을 골랐지만 한 번도 밥(분석)을 못 받은 상태. 종마다 무늬 색이 살짝 다르다.
 * 정지하지 않는다: 숨쉬듯 부풀고, 가끔 안에서 톡톡 치는 것처럼 흔들린다. 첫 분석이 저장되면 부화한다 (6-5).
 */
import { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from "react-native-svg";
import { useAnimatedStyle } from "react-native-reanimated";

import type { AnimalTypeId } from "@/shared/garden-utils";

import { Group, Layer, useGradId } from "./Layer";
import { useMotionEnabled, useOscillator, usePulse } from "./motion";
import { egg as E, props as P } from "./palette";

const SPECKLES: readonly [number, number, number][] = [
  [98, 96, 4.2],
  [138, 84, 3.2],
  [124, 118, 5],
  [92, 138, 3.4],
  [146, 146, 4.4],
  [112, 168, 3.2],
  [134, 184, 3.6],
  [100, 190, 2.6],
];

export default function Egg({
  size,
  type,
  animate = true,
}: {
  size: number;
  type: AnimalTypeId | null;
  animate?: boolean;
}) {
  const s = size / 240;
  const enabled = useMotionEnabled(animate);
  const grad = useGradId("egg");
  const breath = useOscillator(3000, enabled);
  const shake = useOscillator(280, enabled);
  const shakeEnv = usePulse(enabled, 1000, 2600, 800);
  const glow = useOscillator(2600, enabled, 400);
  const speckle = E.speckle[type ?? "cat"];

  const body = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${shake.get() * shakeEnv.get() * 7}deg` },
      { scaleY: 1 + ((breath.get() + 1) / 2) * 0.022 },
      { scaleX: 1 - ((breath.get() + 1) / 2) * 0.01 },
    ],
  }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.55 + glow.get() * 0.25, transform: [{ scale: 1 + glow.get() * 0.03 }] }));
  const hop = useAnimatedStyle(() => ({ transform: [{ translateY: -shakeEnv.get() * 3 * s }, { scale: 0.86 }] }));

  return (
    <Group size={size} origin={[120, 210]} style={hop}>
      {/* 알이 품은 따뜻한 빛 — 반투명 원을 겹쳐서 만든다 */}
      <Layer size={size} origin={[120, 132]} style={halo}>
        <Ellipse cx={120} cy={134} rx={92} ry={106} fill="rgba(255, 214, 140, 0.05)" />
        <Ellipse cx={120} cy={134} rx={78} ry={92} fill="rgba(255, 214, 140, 0.06)" />
        <Ellipse cx={120} cy={134} rx={66} ry={82} fill="rgba(255, 214, 140, 0.07)" />
      </Layer>

      <Layer size={size}>
        <Ellipse cx={120} cy={216} rx={54} ry={8} fill={P.shadow} />
      </Layer>

      <Layer size={size} origin={[120, 206]} style={body}>
        <Defs>
          <LinearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={E.shellLight} />
            <Stop offset="0.5" stopColor={E.shell} />
            <Stop offset="1" stopColor={E.shellShade} />
          </LinearGradient>
        </Defs>
        {/* 알 몸통 — 위가 좁고 아래가 넓은 달걀 모양 */}
        <Path
          d="M120 54 C 158 54 184 108 184 152 C 184 190 156 212 120 212 C 84 212 56 190 56 152 C 56 108 82 54 120 54 Z"
          fill={`url(#${grad})`}
          stroke={E.shellShade}
          strokeWidth={1.5}
        />
        {SPECKLES.map(([cx, cy, r], i) => (
          <Circle key={i} cx={cx} cy={cy} r={r} fill={speckle} opacity={0.5} />
        ))}
        {/* 금 */}
        <Path d="M104 96 L114 112 L104 124 L118 140" stroke={E.crack} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d="M114 112 L126 106" stroke={E.crack} strokeWidth={2} strokeLinecap="round" fill="none" />
        {/* 하이라이트 (램프는 오른쪽 위) */}
        <Ellipse cx={144} cy={92} rx={9} ry={17} fill="#FFFFFF" opacity={0.42} transform="rotate(24 144 92)" />
        <Circle cx={156} cy={126} r={3} fill="#FFFFFF" opacity={0.4} />
      </Layer>
    </Group>
  );
}
