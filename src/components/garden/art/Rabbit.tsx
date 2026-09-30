/**
 * 토끼 리그 — 앉아서 정면을 보는 라벤더빛 흰 토끼. 캔버스 240 단위.
 *
 * 부위(뒤 → 앞): 그림자 · 솜꼬리 · 뒷발 2 · 몸 · 스카프 · 앞발 2 · 머리[귀 2 · 얼굴 · 코 · 눈 · 눈물 · 왕관]
 * 배고픈 행동 (docs/garden-game-design.md 3장): 출출 — **뒷발을 쿵쿵 구르고**(토끼의 실제 습성) 귀를 세우며 코를 씰룩 ·
 * 굶주림 — 귀가 완전히 처져(lop) 얼굴 옆으로 늘어지고 코만 움찔한다.
 */
import { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useAnimatedStyle } from "react-native-reanimated";

import { Group, Layer, useGradId } from "./Layer";
import { useBurst, useOscillator } from "./motion";
import { rabbit as R, props as P } from "./palette";
import { HEAD_SCALE, STAGE_SCALE, type PetProps } from "./types";
import { usePetMotion } from "./usePetMotion";

export default function Rabbit({ size, condition, stage, anxious = false, animate = true }: PetProps) {
  const s = size / 240;
  const m = usePetMotion({ condition, anxious, animate });
  const { mood } = m;
  const bodyGrad = useGradId("rabBody");
  const headGrad = useGradId("rabHead");
  const legGrad = useGradId("rabLeg");
  const peckish = condition === "peckish";
  // 발 구르기 — 3번 연달아 쿵쿵 → 쉼
  const thump = useBurst(m.enabled && peckish, 3, 230, anxious ? 1500 : 2900, 400);
  const sniff = useOscillator(m.enabled ? 440 : 0, m.enabled);

  const scale = STAGE_SCALE[stage];
  const showScarf = stage === "enhanced" || stage === "legend";
  const showCrown = stage === "legend";
  const smiling = mood.mouth === "smile";

  const root = useAnimatedStyle(() => ({
    transform: [
      { translateX: m.shiver.get() * mood.tremble * s },
      { translateY: -m.hop.get() * 18 * s + thump.get() * 2.5 * s },
      { scale },
    ],
  }));
  const puff = useAnimatedStyle(() => ({
    transform: [{ rotate: `${m.tail.get() * (mood.tailAmp * 0.45)}deg` }, { scale: 1 + thump.get() * 0.08 }],
  }));
  const footL = useAnimatedStyle(() => ({
    transform: [{ translateY: -thump.get() * 9 * s }, { rotate: `${-thump.get() * 12}deg` }],
  }));
  const body = useAnimatedStyle(() => {
    const breath = (m.breath.get() + 1) / 2;
    return { transform: [{ scaleY: 1 + breath * mood.breathAmp }, { scaleX: 1 - breath * mood.breathAmp * 0.4 }] };
  });
  const head = useAnimatedStyle(() => {
    const breath = (m.breath.get() + 1) / 2;
    return { transform: [{ translateY: (m.slump.get() - breath * mood.headBob) * s }, { scale: HEAD_SCALE[stage] }] };
  });
  // 귀 — 평소엔 살짝 벌어져 서 있고, 출출하면 쫑긋, 굶주리면 옆으로 축 처진다(lop). 발 구를 때 같이 튄다
  const earL = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-9 - m.droop.get() * 2.3 - m.earTwitch.get() * 8 - thump.get() * 5}deg` }],
  }));
  const earR = useAnimatedStyle(() => ({
    transform: [{ rotate: `${9 + m.droop.get() * 2.3 + m.earTwitch.get() * 5 + thump.get() * 5}deg` }],
  }));
  const eyes = useAnimatedStyle(() => {
    const lookAtMe = m.look.get();
    return {
      transform: [
        { translateX: mood.gazeX * (1 - lookAtMe) * s },
        { translateY: mood.gazeY * (1 - lookAtMe) * s },
        { scaleY: (1 - m.lid.get() * 0.55) * (1 - m.blink.get() * 0.92) * m.eyeScale.get() },
        { scaleX: m.eyeScale.get() },
      ],
    };
  });
  const nose = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + sniff.get() * 0.14 }, { scaleY: 1 + sniff.get() * 0.1 }, { translateY: sniff.get() * 0.4 * s }],
  }));
  const tear = useAnimatedStyle(() => {
    const t = m.tearFall.get();
    return { opacity: Math.min(1, t * 6) * (1 - t * 0.55), transform: [{ translateY: t * 15 * s }] };
  });

  return (
    <Group size={size} origin={[120, 226]} style={root}>
      <Layer size={size}>
        <Ellipse cx={120} cy={226} rx={66} ry={8.5} fill={P.shadow} />
      </Layer>

      {/* 솜꼬리 */}
      <Layer size={size} origin={[176, 206]} style={puff}>
        <Circle cx={180} cy={204} r={15} fill={R.tail} stroke={R.shade} strokeWidth={1.2} />
        <Circle cx={175} cy={200} r={9} fill="#FFFFFF" />
        <Circle cx={185} cy={208} r={6} fill={R.shade} opacity={0.25} />
      </Layer>

      {/* 뒷발 — 왼쪽이 쿵쿵 구른다 */}
      <Layer size={size} origin={[76, 214]} style={footL}>
        <Ellipse cx={72} cy={216} rx={26} ry={11.5} fill={R.base} stroke={R.shade} strokeWidth={1.4} />
        <Path d="M50 216 Q72 224 94 216" stroke={R.shade} strokeWidth={1.4} fill="none" opacity={0.4} />
      </Layer>
      <Layer size={size}>
        <Ellipse cx={168} cy={216} rx={26} ry={11.5} fill={R.base} stroke={R.shade} strokeWidth={1.4} />
        <Path d="M146 216 Q168 224 190 216" stroke={R.shade} strokeWidth={1.4} fill="none" opacity={0.4} />
      </Layer>

      {/* 몸 */}
      <Layer size={size} origin={[120, 226]} style={body}>
        <Defs>
          <LinearGradient id={bodyGrad} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={R.light} />
            <Stop offset="0.45" stopColor={R.base} />
            <Stop offset="1" stopColor={R.shade} />
          </LinearGradient>
        </Defs>
        <Ellipse cx={120} cy={178} rx={54} ry={47} fill={`url(#${bodyGrad})`} />
        <Ellipse cx={120} cy={192} rx={31} ry={30} fill={R.belly} opacity={0.92} />
        <Ellipse cx={120} cy={152} rx={42} ry={10} fill={R.shade} opacity={0.4} />
        <Path d="M74 168 C66 178 66 192 72 204" stroke="rgba(255,255,255,0.7)" strokeWidth={3} strokeLinecap="round" fill="none" />
      </Layer>

      {showScarf ? (
        <Layer size={size} style={head}>
          <Path d="M80 152 Q120 170 160 152 L164 165 Q120 186 76 165 Z" fill={P.scarf} />
          <Path d="M138 167 L152 196 L138 192 L130 171 Z" fill={P.scarfShade} />
          <Path d="M80 154 Q120 172 160 154" stroke="rgba(255,255,255,0.28)" strokeWidth={2} fill="none" />
        </Layer>
      ) : null}

      {/* 앞발 */}
      <Layer size={size}>
        <Defs>
          <LinearGradient id={legGrad} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={R.light} />
            <Stop offset="1" stopColor={R.shade} />
          </LinearGradient>
        </Defs>
        <Path d="M96 190 Q94 206 96 214 L112 214 Q114 206 112 190 Z" fill={`url(#${legGrad})`} />
        <Ellipse cx={104} cy={218} rx={13} ry={8.5} fill={R.base} stroke={R.shade} strokeWidth={1.3} />
        <Path d="M128 190 Q126 206 128 214 L144 214 Q146 206 144 190 Z" fill={`url(#${legGrad})`} />
        <Ellipse cx={136} cy={218} rx={13} ry={8.5} fill={R.base} stroke={R.shade} strokeWidth={1.3} />
      </Layer>

      {/* 머리 */}
      <Group size={size} origin={[120, 146]} style={head}>
        {/* 긴 귀 — 뿌리 (100, 88)(140, 88)를 축으로 */}
        <Layer size={size} origin={[102, 90]} style={earL}>
          <Ellipse cx={98} cy={44} rx={15.5} ry={46} fill={R.base} stroke={R.shade} strokeWidth={1.5} />
          <Ellipse cx={99} cy={50} rx={8.4} ry={34} fill={R.earInner} />
          <Path d="M92 24 Q89 46 92 68" stroke="rgba(255,255,255,0.5)" strokeWidth={2.4} strokeLinecap="round" fill="none" />
        </Layer>
        <Layer size={size} origin={[138, 90]} style={earR}>
          <Ellipse cx={142} cy={44} rx={15.5} ry={46} fill={R.base} stroke={R.shade} strokeWidth={1.5} />
          <Ellipse cx={141} cy={50} rx={8.4} ry={34} fill={R.earInner} />
          <Path d="M148 24 Q151 46 148 68" stroke="rgba(255,255,255,0.4)" strokeWidth={2.4} strokeLinecap="round" fill="none" />
        </Layer>

        <Layer size={size}>
          <Defs>
            <LinearGradient id={headGrad} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={R.light} />
              <Stop offset="0.55" stopColor={R.base} />
              <Stop offset="1" stopColor={R.shade} />
            </LinearGradient>
          </Defs>
          <Ellipse cx={120} cy={122} rx={55} ry={47} fill={`url(#${headGrad})`} />
          <Path d="M168 90 Q178 102 177 118" stroke="rgba(255,255,255,0.75)" strokeWidth={3.5} strokeLinecap="round" fill="none" />
          <Ellipse cx={81} cy={132} rx={11} ry={7} fill={R.blush} opacity={0.4} />
          <Ellipse cx={159} cy={132} rx={11} ry={7} fill={R.blush} opacity={0.4} />
          <Ellipse cx={120} cy={137} rx={21} ry={13} fill={R.belly} />
          {/* 수염 점 */}
          <G fill={R.shade} opacity={0.5}>
            <Circle cx={97} cy={136} r={1.5} />
            <Circle cx={91} cy={140} r={1.5} />
            <Circle cx={97} cy={143} r={1.5} />
            <Circle cx={143} cy={136} r={1.5} />
            <Circle cx={149} cy={140} r={1.5} />
            <Circle cx={143} cy={143} r={1.5} />
          </G>
          <Mouth mouth={mood.mouth} teeth={smiling} />
          {mood.tear ? (
            <G stroke={R.shade} strokeWidth={3} strokeLinecap="round" fill="none">
              <Path d="M82 108 Q94 104 106 97" />
              <Path d="M158 108 Q146 104 134 97" />
            </G>
          ) : null}
        </Layer>

        {/* 코 — 씰룩 */}
        <Layer size={size} origin={[120, 130]} style={nose}>
          <Ellipse cx={120} cy={130} rx={5.6} ry={4} fill={R.nose} />
          <Ellipse cx={118.5} cy={128.6} rx={1.8} ry={1} fill="#FFFFFF" opacity={0.6} />
        </Layer>

        <Layer size={size} origin={[120, 118]} style={eyes}>
          <Ellipse cx={95} cy={116} rx={10.5} ry={13} fill={R.eye} />
          <Ellipse cx={145} cy={116} rx={10.5} ry={13} fill={R.eye} />
          <Ellipse cx={95} cy={122} rx={6.6} ry={5.4} fill="#7C66C9" opacity={0.55} />
          <Ellipse cx={145} cy={122} rx={6.6} ry={5.4} fill="#7C66C9" opacity={0.55} />
          <Circle cx={98.5} cy={110.5} r={4} fill="#FFFFFF" />
          <Circle cx={148.5} cy={110.5} r={4} fill="#FFFFFF" />
          <Circle cx={91.5} cy={122} r={2} fill="#FFFFFF" opacity={0.55} />
          <Circle cx={141.5} cy={122} r={2} fill="#FFFFFF" opacity={0.55} />
        </Layer>

        {mood.tear ? (
          <Layer size={size} style={tear}>
            <Path d="M85 130 Q81 138 85 142 Q90 138 85 130 Z" fill={P.tear} opacity={0.9} />
          </Layer>
        ) : null}

        {showCrown ? (
          <Layer size={size}>
            <Path d="M100 84 L105 62 L115 76 L120 56 L125 76 L135 62 L140 84 Z" fill={P.gold} stroke={P.goldShade} strokeWidth={1.4} strokeLinejoin="round" />
            <Circle cx={120} cy={68} r={2.4} fill={P.heart} />
          </Layer>
        ) : null}
      </Group>
    </Group>
  );
}

/** 토끼 입 — Y자. 웃을 땐 앞니가 살짝 보인다 */
function Mouth({ mouth, teeth }: { mouth: "smile" | "open" | "flat" | "frown"; teeth: boolean }) {
  const line = { stroke: R.mouth, strokeWidth: 2.2, strokeLinecap: "round" as const, fill: "none" };
  switch (mouth) {
    case "smile":
      return (
        <>
          <Path d="M120 133 v4" {...line} />
          <Path d="M120 137 Q113 146 105 140" {...line} />
          <Path d="M120 137 Q127 146 135 140" {...line} />
          {teeth ? (
            <>
              <Rect x={116} y={139} width={3.8} height={6.5} rx={1.2} fill="#FFFFFF" stroke={R.shade} strokeWidth={0.8} />
              <Rect x={120.2} y={139} width={3.8} height={6.5} rx={1.2} fill="#FFFFFF" stroke={R.shade} strokeWidth={0.8} />
            </>
          ) : null}
        </>
      );
    case "open":
      return (
        <>
          <Path d="M120 133 v3" {...line} />
          <Path d="M113 138 Q120 150 127 138 Z" fill="#8A2F4E" stroke={R.mouth} strokeWidth={1.4} strokeLinejoin="round" />
        </>
      );
    case "flat":
      return (
        <>
          <Path d="M120 133 v4" {...line} />
          <Path d="M112 142 Q120 139 128 142" {...line} />
        </>
      );
    case "frown":
      return (
        <>
          <Path d="M120 133 v4" {...line} />
          <Path d="M110 146 Q120 136 130 146" {...line} />
        </>
      );
  }
}
