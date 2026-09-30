/**
 * 고양이 리그 — 앉아서 정면을 보는 생강색 고양이. 캔버스 240 단위.
 *
 * 부위(뒤 → 앞): 그림자 · 꼬리 · 몸 · 스카프 · 앞발 2 · 머리[귀 2 · 얼굴 · 눈 · 코입 · 눈물 · 왕관]
 * 배고픈 행동 (docs/garden-game-design.md 3장): 출출 — 빈 그릇을 앞발로 툭툭 · 빈 그릇과 나를 번갈아 힐끔 ·
 * 굶주림 — 웅크려 떨고 귀를 눕히고 눈이 반쯤 감기고 눈물이 맺힌다.
 */
import { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from "react-native-svg";
import { useAnimatedStyle } from "react-native-reanimated";

import { Group, Layer, useGradId } from "./Layer";
import { useBurst } from "./motion";
import { cat as C, props as P } from "./palette";
import { HEAD_SCALE, STAGE_SCALE, type PetProps } from "./types";
import { usePetMotion } from "./usePetMotion";

export default function Cat({ size, condition, stage, anxious = false, animate = true }: PetProps) {
  const s = size / 240;
  const m = usePetMotion({ condition, anxious, animate });
  const { mood } = m;
  const bodyGrad = useGradId("catBody");
  const headGrad = useGradId("catHead");
  const legGrad = useGradId("catLeg");
  const legGradR = useGradId("catLegR");
  const tap = useBurst(m.enabled && condition === "peckish", 2, 260, anxious ? 1800 : 3200, 300);

  const scale = STAGE_SCALE[stage];
  const showScarf = stage === "enhanced" || stage === "legend";
  const showCrown = stage === "legend";

  const root = useAnimatedStyle(() => ({
    transform: [
      { translateX: m.shiver.get() * mood.tremble * s },
      { translateY: -m.hop.get() * 16 * s },
      { scale },
    ],
  }));
  const tail = useAnimatedStyle(() => ({
    transform: [{ rotate: `${m.tailBase.get() + m.tail.get() * mood.tailAmp}deg` }],
  }));
  const body = useAnimatedStyle(() => {
    const breath = (m.breath.get() + 1) / 2;
    return { transform: [{ scaleY: 1 + breath * mood.breathAmp }, { scaleX: 1 - breath * mood.breathAmp * 0.4 }] };
  });
  const head = useAnimatedStyle(() => {
    const breath = (m.breath.get() + 1) / 2;
    return { transform: [{ translateY: (m.slump.get() - breath * mood.headBob) * s }, { scale: HEAD_SCALE[stage] }] };
  });
  const earL = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-m.droop.get() - m.earTwitch.get() * 9}deg` }],
  }));
  const earR = useAnimatedStyle(() => ({
    transform: [{ rotate: `${m.droop.get() + m.earTwitch.get() * 4}deg` }],
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
  const pawR = useAnimatedStyle(() => ({
    transform: [{ translateY: -tap.get() * 7 * s }, { rotate: `${tap.get() * 7}deg` }],
  }));
  const tear = useAnimatedStyle(() => {
    const t = m.tearFall.get();
    return { opacity: Math.min(1, t * 6) * (1 - t * 0.55), transform: [{ translateY: t * 15 * s }] };
  });

  return (
    <Group size={size} origin={[120, 226]} style={root}>
      {/* 그림자 */}
      <Layer size={size}>
        <Ellipse cx={120} cy={226} rx={68} ry={8.5} fill={P.shadow} />
      </Layer>

      {/* 꼬리 — 뿌리(172, 214)를 축으로 흔든다 */}
      <Layer size={size} origin={[172, 214]} style={tail}>
        <Path d="M172 216 C212 222 236 182 217 146" stroke={C.shade} strokeWidth={19} strokeLinecap="round" fill="none" />
        <Path d="M172 216 C212 222 236 182 217 146" stroke={C.base} strokeWidth={14} strokeLinecap="round" fill="none" />
        <Path d="M176 211 C207 214 227 184 214 152" stroke={C.light} strokeWidth={3.5} strokeLinecap="round" fill="none" opacity={0.55} />
        <Circle cx={217} cy={146} r={8.5} fill={C.tailTip} />
      </Layer>

      {/* 몸 — 숨쉴 때 바닥(120, 226)을 축으로 늘어난다 */}
      <Layer size={size} origin={[120, 226]} style={body}>
        <Defs>
          <LinearGradient id={bodyGrad} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.light} />
            <Stop offset="0.42" stopColor={C.base} />
            <Stop offset="1" stopColor={C.shade} />
          </LinearGradient>
        </Defs>
        <Path
          d="M82 150 C60 168 48 196 58 216 C66 230 174 230 182 216 C192 196 180 168 158 150 C146 142 94 142 82 150 Z"
          fill={`url(#${bodyGrad})`}
        />
        {/* 뒷다리 볼록 */}
        <Ellipse cx={72} cy={208} rx={22} ry={17} fill={C.base} />
        <Ellipse cx={168} cy={208} rx={22} ry={17} fill={C.base} />
        <Path d="M54 204 C56 192 68 188 78 192" stroke={C.light} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.5} />
        <Path d="M162 192 C172 188 184 192 186 204" stroke={C.light} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.7} />
        {/* 배 */}
        <Ellipse cx={120} cy={192} rx={30} ry={34} fill={C.belly} opacity={0.95} />
        {/* 턱 밑 그림자 */}
        <Ellipse cx={120} cy={156} rx={44} ry={11} fill={C.shade} opacity={0.42} />
        {/* 옆구리 줄무늬 */}
        <G stroke={C.stripe} strokeWidth={3} strokeLinecap="round" opacity={0.45}>
          <Path d="M64 178 l13 4" />
          <Path d="M60 190 l14 3" />
          <Path d="M176 178 l-13 4" />
          <Path d="M180 190 l-14 3" />
        </G>
      </Layer>

      {/* 스카프 (강화 성체 이상) */}
      {showScarf ? (
        <Layer size={size} style={head}>
          <Path d="M78 148 Q120 168 162 148 L166 162 Q120 184 74 162 Z" fill={P.scarf} />
          <Path d="M138 164 L152 194 L138 190 L130 168 Z" fill={P.scarfShade} />
          <Path d="M78 150 Q120 170 162 150" stroke="rgba(255,255,255,0.28)" strokeWidth={2} fill="none" />
        </Layer>
      ) : null}

      {/* 앞발 — 다리는 좁고 발은 둥글다 */}
      <Layer size={size}>
        <Defs>
          <LinearGradient id={legGrad} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={C.light} />
            <Stop offset="0.55" stopColor={C.base} />
            <Stop offset="1" stopColor={C.shade} />
          </LinearGradient>
        </Defs>
        <Path d="M95 172 Q93 198 95 214 L115 214 Q117 198 115 172 Z" fill={`url(#${legGrad})`} />
        <Ellipse cx={104} cy={221} rx={17} ry={10.5} fill={C.base} stroke={C.shade} strokeWidth={1.4} />
        <G stroke={C.shade} strokeWidth={1.4} strokeLinecap="round" opacity={0.55}>
          <Path d="M98 222 v6" />
          <Path d="M104 223 v6" />
          <Path d="M110 222 v6" />
        </G>
      </Layer>
      <Layer size={size} origin={[134, 178]} style={pawR}>
        <Defs>
          <LinearGradient id={legGradR} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={C.light} />
            <Stop offset="0.55" stopColor={C.base} />
            <Stop offset="1" stopColor={C.shade} />
          </LinearGradient>
        </Defs>
        <Path d="M145 172 Q147 198 145 214 L125 214 Q123 198 125 172 Z" fill={`url(#${legGradR})`} />
        <Ellipse cx={136} cy={221} rx={17} ry={10.5} fill={C.base} stroke={C.shade} strokeWidth={1.4} />
        <G stroke={C.shade} strokeWidth={1.4} strokeLinecap="round" opacity={0.55}>
          <Path d="M130 222 v6" />
          <Path d="M136 223 v6" />
          <Path d="M142 222 v6" />
        </G>
      </Layer>

      {/* 머리 — 숨에 맞춰 살짝 오르내린다 */}
      <Group size={size} origin={[120, 140]} style={head}>
        {/* 귀 */}
        <Layer size={size} origin={[86, 68]} style={earL}>
          <Path d="M62 76 Q54 40 70 12 Q98 26 114 56 Z" fill={C.base} stroke={C.shade} strokeWidth={1.5} strokeLinejoin="round" />
          <Path d="M73 64 Q68 42 77 26 Q93 36 104 56 Z" fill={C.earInner} />
        </Layer>
        <Layer size={size} origin={[154, 68]} style={earR}>
          <Path d="M178 76 Q186 40 170 12 Q142 26 126 56 Z" fill={C.base} stroke={C.shade} strokeWidth={1.5} strokeLinejoin="round" />
          <Path d="M167 64 Q172 42 163 26 Q147 36 136 56 Z" fill={C.earInner} />
        </Layer>

        {/* 얼굴 */}
        <Layer size={size}>
          <Defs>
            <LinearGradient id={headGrad} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={C.light} />
              <Stop offset="0.55" stopColor={C.base} />
              <Stop offset="1" stopColor={C.shade} />
            </LinearGradient>
          </Defs>
          {/* 볼 털 */}
          <Path d="M62 98 Q42 104 44 124 Q58 124 68 116 Z" fill={C.base} stroke={C.shade} strokeWidth={1.2} strokeLinejoin="round" />
          <Path d="M178 98 Q198 104 196 124 Q182 124 172 116 Z" fill={C.base} stroke={C.shade} strokeWidth={1.2} strokeLinejoin="round" />
          <Ellipse cx={120} cy={100} rx={65} ry={54} fill={`url(#${headGrad})`} />
          {/* 램프 빛 림라이트 (오른쪽 위) */}
          <Path d="M172 70 Q184 82 184 98" stroke="rgba(255,240,205,0.5)" strokeWidth={3.5} strokeLinecap="round" fill="none" />
          {/* 이마 줄무늬 */}
          <G stroke={C.stripe} strokeWidth={3.2} strokeLinecap="round" opacity={0.55}>
            <Path d="M120 50 v15" />
            <Path d="M107 53 l3 12" />
            <Path d="M133 53 l-3 12" />
          </G>
          {/* 주둥이 · 볼터치 */}
          <Ellipse cx={120} cy={124} rx={23} ry={15} fill={C.belly} opacity={0.92} />
          <Ellipse cx={76} cy={118} rx={11} ry={7} fill={C.blush} opacity={0.32} />
          <Ellipse cx={164} cy={118} rx={11} ry={7} fill={C.blush} opacity={0.32} />
          {/* 수염 */}
          <G stroke={C.whisker} strokeWidth={1.5} strokeLinecap="round">
            <Path d="M80 118 L44 111" />
            <Path d="M80 123 L42 124" />
            <Path d="M82 128 L48 137" />
            <Path d="M160 118 L196 111" />
            <Path d="M160 123 L198 124" />
            <Path d="M158 128 L192 137" />
          </G>
          {/* 코 */}
          <Path d="M113 111 Q120 107 127 111 Q124 118 120 119 Q116 118 113 111 Z" fill={C.nose} />
          {/* 입 — 상태에 따라 */}
          <Mouth mouth={mood.mouth} />
          {/* 슬픈 눈썹 (굶주림) */}
          {mood.tear ? (
            <G stroke={C.shade} strokeWidth={3.2} strokeLinecap="round" fill="none">
              <Path d="M80 91 Q92 87 106 80" />
              <Path d="M160 91 Q148 87 134 80" />
            </G>
          ) : null}
        </Layer>

        {/* 눈 — 깜빡임 · 눈꺼풀 · 시선 */}
        <Layer size={size} origin={[120, 112]} style={eyes}>
          <Ellipse cx={94} cy={100} rx={12.5} ry={15} fill={C.eye} />
          <Ellipse cx={146} cy={100} rx={12.5} ry={15} fill={C.eye} />
          <Ellipse cx={94} cy={107} rx={8} ry={6.5} fill={C.iris} opacity={0.6} />
          <Ellipse cx={146} cy={107} rx={8} ry={6.5} fill={C.iris} opacity={0.6} />
          <Circle cx={98} cy={94} r={4.4} fill="#FFFFFF" />
          <Circle cx={150} cy={94} r={4.4} fill="#FFFFFF" />
          <Circle cx={90} cy={107} r={2.2} fill="#FFFFFF" opacity={0.55} />
          <Circle cx={142} cy={107} r={2.2} fill="#FFFFFF" opacity={0.55} />
        </Layer>

        {/* 눈물 (굶주림) */}
        {mood.tear ? (
          <Layer size={size} style={tear}>
            <Path d="M84 116 Q80 124 84 128 Q89 124 84 116 Z" fill={P.tear} opacity={0.9} />
          </Layer>
        ) : null}

        {/* 왕관 (전설) */}
        {showCrown ? (
          <Layer size={size}>
            <Path d="M94 50 L100 24 L113 40 L120 18 L127 40 L140 24 L146 50 Z" fill={P.gold} stroke={P.goldShade} strokeWidth={1.5} strokeLinejoin="round" />
            <Circle cx={120} cy={30} r={2.6} fill={P.heart} />
            <Circle cx={104} cy={38} r={2} fill={P.tear} />
            <Circle cx={136} cy={38} r={2} fill={P.tear} />
          </Layer>
        ) : null}
      </Group>
    </Group>
  );
}

/** 고양이 입 — "w" 웃음 · 야옹(열림) · 일자 · 시무룩 */
function Mouth({ mouth }: { mouth: "smile" | "open" | "flat" | "frown" }) {
  const common = { stroke: C.mouth, strokeWidth: 2.3, strokeLinecap: "round" as const, fill: "none" };
  switch (mouth) {
    case "smile":
      return (
        <>
          <Path d="M120 119 v5" {...common} />
          <Path d="M120 124 Q113 134 103 127" {...common} />
          <Path d="M120 124 Q127 134 137 127" {...common} />
        </>
      );
    case "open":
      return (
        <>
          <Path d="M120 119 v3" {...common} />
          <Path d="M112 124 Q120 142 128 124 Z" fill="#8A2F4E" stroke={C.mouth} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M115 133 Q120 138 125 133 Q120 130 115 133 Z" fill="#FF8FA3" />
        </>
      );
    case "flat":
      return (
        <>
          <Path d="M120 119 v5" {...common} />
          <Path d="M110 129 Q120 125 130 129" {...common} />
        </>
      );
    case "frown":
      return (
        <>
          <Path d="M120 119 v5" {...common} />
          <Path d="M108 134 Q120 122 132 134" {...common} />
        </>
      );
  }
}
