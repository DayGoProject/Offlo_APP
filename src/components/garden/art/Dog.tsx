/**
 * 강아지 리그 — 앉아서 정면을 보는 황금빛 강아지. 캔버스 240 단위.
 *
 * 부위(뒤 → 앞): 그림자 · 꼬리 · 몸 · 스카프 · 앞발 2 · 머리[귀 2 · 얼굴 · 눈썹 점 · 눈 · 코입 · 눈물 · 왕관]
 * 배고픈 행동 (docs/garden-game-design.md 3장): 출출 — 고개를 갸웃하고 귀를 쫑긋 세우고 앞발을 들어 "주세요" 하며 낑낑 ·
 * 굶주림 — 귀가 처지고 눈썹이 팔(八)자로 내려오고 꼬리가 축 늘어져 떤다.
 */
import { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from "react-native-svg";
import { useAnimatedStyle } from "react-native-reanimated";

import { Group, Layer, useGradId } from "./Layer";
import { usePulse } from "./motion";
import { dog as D, props as P } from "./palette";
import { HEAD_SCALE, STAGE_SCALE, type PetProps } from "./types";
import { usePetMotion } from "./usePetMotion";

export default function Dog({ size, condition, stage, anxious = false, animate = true }: PetProps) {
  const s = size / 240;
  const m = usePetMotion({ condition, anxious, animate });
  const { mood } = m;
  const bodyGrad = useGradId("dogBody");
  const headGrad = useGradId("dogHead");
  const legGrad = useGradId("dogLeg");
  const legGradR = useGradId("dogLegR");
  const earGradL = useGradId("dogEarL");
  const earGradR = useGradId("dogEarR");
  const peckish = condition === "peckish";
  // 고개 갸웃 — 가끔 한쪽으로 기울인다 / 앞발 들기("주세요")
  const tilt = usePulse(m.enabled && peckish, 900, anxious ? 1500 : 2800, 500);
  const beg = usePulse(m.enabled && peckish, 700, anxious ? 1400 : 3200, 1700);

  const scale = STAGE_SCALE[stage];
  const showScarf = stage === "enhanced" || stage === "legend";
  const showCrown = stage === "legend";

  const root = useAnimatedStyle(() => ({
    transform: [
      { translateX: m.shiver.get() * mood.tremble * s },
      { translateY: -m.hop.get() * 16 * s + beg.get() * -2 * s },
      { scale },
    ],
  }));
  // 개 꼬리는 많이 흔든다 — 배부름일 때는 빠르고 크게
  const tail = useAnimatedStyle(() => ({
    transform: [{ rotate: `${m.tailBase.get() + m.tail.get() * mood.tailAmp * 1.4}deg` }],
  }));
  const body = useAnimatedStyle(() => {
    const breath = (m.breath.get() + 1) / 2;
    return { transform: [{ scaleY: 1 + breath * mood.breathAmp }, { scaleX: 1 - breath * mood.breathAmp * 0.4 }] };
  });
  const head = useAnimatedStyle(() => {
    const breath = (m.breath.get() + 1) / 2;
    return {
      transform: [
        { translateY: (m.slump.get() - breath * mood.headBob) * s },
        { rotate: `${tilt.get() * -9}deg` },
        { scale: HEAD_SCALE[stage] },
      ],
    };
  });
  // 늘어진 귀 — 출출하면 쫑긋(바깥으로 들림), 굶주리면 축 처져 얼굴에 붙는다
  const earL = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(peckish ? 12 : 0) - m.droop.get() * 0.5 + m.earTwitch.get() * 6 - tilt.get() * 6}deg` }],
  }));
  const earR = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-(peckish ? 12 : 0) + m.droop.get() * 0.5 - m.earTwitch.get() * 4 + tilt.get() * 4}deg` }],
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
  // 눈썹 점 — 출출하면 걱정스럽게 올라가고, 굶주리면 팔(八)자로 처진다
  const brows = useAnimatedStyle(() => ({
    transform: [{ translateY: (peckish ? -3 : 0) * s + m.lid.get() * 4 * s }],
  }));
  const pawR = useAnimatedStyle(() => ({
    transform: [{ translateY: -beg.get() * 16 * s }, { rotate: `${beg.get() * -16}deg` }],
  }));
  const tear = useAnimatedStyle(() => {
    const t = m.tearFall.get();
    return { opacity: Math.min(1, t * 6) * (1 - t * 0.55), transform: [{ translateY: t * 15 * s }] };
  });

  return (
    <Group size={size} origin={[120, 226]} style={root}>
      <Layer size={size}>
        <Ellipse cx={120} cy={226} rx={68} ry={8.5} fill={P.shadow} />
      </Layer>

      {/* 꼬리 — 통통하게 위로 말린다 */}
      <Layer size={size} origin={[170, 212]} style={tail}>
        <Path d="M170 214 C204 218 230 190 222 156" stroke={D.shade} strokeWidth={22} strokeLinecap="round" fill="none" />
        <Path d="M170 214 C204 218 230 190 222 156" stroke={D.base} strokeWidth={17} strokeLinecap="round" fill="none" />
        <Path d="M176 209 C203 212 224 190 218 162" stroke={D.light} strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.6} />
        <Ellipse cx={222} cy={154} rx={10} ry={11} fill={D.light} />
      </Layer>

      {/* 몸 */}
      <Layer size={size} origin={[120, 226]} style={body}>
        <Defs>
          <LinearGradient id={bodyGrad} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={D.light} />
            <Stop offset="0.42" stopColor={D.base} />
            <Stop offset="1" stopColor={D.shade} />
          </LinearGradient>
        </Defs>
        <Path
          d="M80 150 C56 170 46 198 56 217 C64 231 176 231 184 217 C194 198 184 170 160 150 C148 142 92 142 80 150 Z"
          fill={`url(#${bodyGrad})`}
        />
        <Ellipse cx={70} cy={209} rx={23} ry={18} fill={D.base} />
        <Ellipse cx={170} cy={209} rx={23} ry={18} fill={D.base} />
        <Path d="M52 205 C54 192 67 188 78 193" stroke={D.light} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.5} />
        <Path d="M162 193 C173 188 186 192 188 205" stroke={D.light} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.7} />
        {/* 가슴 털 */}
        <Path d="M120 156 C96 160 90 200 120 214 C150 200 144 160 120 156 Z" fill={D.belly} opacity={0.95} />
        <Path d="M108 168 l6 7 l6 -7 l6 7 l6 -7" stroke={D.shade} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.35} />
        <Ellipse cx={120} cy={157} rx={46} ry={11} fill={D.shade} opacity={0.4} />
        <G stroke={D.patch} strokeWidth={3} strokeLinecap="round" opacity={0.32}>
          <Path d="M62 180 l12 4" />
          <Path d="M178 180 l-12 4" />
        </G>
      </Layer>

      {showScarf ? (
        <Layer size={size} style={head}>
          <Path d="M78 148 Q120 168 162 148 L166 162 Q120 184 74 162 Z" fill={P.scarf} />
          <Path d="M138 164 L152 194 L138 190 L130 168 Z" fill={P.scarfShade} />
          <Path d="M78 150 Q120 170 162 150" stroke="rgba(255,255,255,0.28)" strokeWidth={2} fill="none" />
        </Layer>
      ) : null}

      {/* 앞발 */}
      <Layer size={size}>
        <Defs>
          <LinearGradient id={legGrad} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={D.light} />
            <Stop offset="0.55" stopColor={D.base} />
            <Stop offset="1" stopColor={D.shade} />
          </LinearGradient>
        </Defs>
        <Path d="M94 172 Q92 198 94 214 L116 214 Q118 198 116 172 Z" fill={`url(#${legGrad})`} />
        <Ellipse cx={104} cy={221} rx={18} ry={11} fill={D.base} stroke={D.shade} strokeWidth={1.4} />
        <G stroke={D.shade} strokeWidth={1.4} strokeLinecap="round" opacity={0.55}>
          <Path d="M97 222 v6" />
          <Path d="M104 223 v6" />
          <Path d="M111 222 v6" />
        </G>
      </Layer>
      <Layer size={size} origin={[134, 178]} style={pawR}>
        <Defs>
          <LinearGradient id={legGradR} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={D.light} />
            <Stop offset="0.55" stopColor={D.base} />
            <Stop offset="1" stopColor={D.shade} />
          </LinearGradient>
        </Defs>
        <Path d="M146 172 Q148 198 146 214 L124 214 Q122 198 124 172 Z" fill={`url(#${legGradR})`} />
        <Ellipse cx={136} cy={221} rx={18} ry={11} fill={D.base} stroke={D.shade} strokeWidth={1.4} />
        <G stroke={D.shade} strokeWidth={1.4} strokeLinecap="round" opacity={0.55}>
          <Path d="M129 222 v6" />
          <Path d="M136 223 v6" />
          <Path d="M143 222 v6" />
        </G>
      </Layer>

      {/* 머리 */}
      <Group size={size} origin={[120, 142]} style={head}>
        {/* 늘어진 귀 — 머리 옆에서 아래로 처진다 */}
        <Layer size={size} origin={[72, 66]} style={earL}>
          <Defs>
            <LinearGradient id={earGradL} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={D.ear} />
              <Stop offset="1" stopColor={D.earShade} />
            </LinearGradient>
          </Defs>
          <Path d="M72 62 C40 60 30 96 38 124 C44 142 64 140 72 122 C78 106 80 80 72 62 Z" fill={`url(#${earGradL})`} />
          <Path d="M64 78 C48 86 46 110 52 122" stroke="rgba(255,255,255,0.14)" strokeWidth={3} strokeLinecap="round" fill="none" />
        </Layer>
        <Layer size={size} origin={[168, 66]} style={earR}>
          <Defs>
            <LinearGradient id={earGradR} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={D.ear} />
              <Stop offset="1" stopColor={D.earShade} />
            </LinearGradient>
          </Defs>
          <Path d="M168 62 C200 60 210 96 202 124 C196 142 176 140 168 122 C162 106 160 80 168 62 Z" fill={`url(#${earGradR})`} />
          <Path d="M176 78 C192 86 194 110 188 122" stroke="rgba(255,255,255,0.14)" strokeWidth={3} strokeLinecap="round" fill="none" />
        </Layer>

        <Layer size={size}>
          <Defs>
            <LinearGradient id={headGrad} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={D.light} />
              <Stop offset="0.55" stopColor={D.base} />
              <Stop offset="1" stopColor={D.shade} />
            </LinearGradient>
          </Defs>
          <Ellipse cx={120} cy={102} rx={64} ry={56} fill={`url(#${headGrad})`} />
          <Path d="M172 66 Q186 80 186 100" stroke="rgba(255,240,205,0.5)" strokeWidth={3.5} strokeLinecap="round" fill="none" />
          {/* 이마 줄무늬 (블레이즈) */}
          <Path d="M120 50 C112 56 112 76 120 88 C128 76 128 56 120 50 Z" fill={D.belly} opacity={0.55} />
          {/* 주둥이 */}
          <Ellipse cx={120} cy={126} rx={32} ry={23} fill={D.belly} />
          <Ellipse cx={120} cy={119} rx={20} ry={9} fill="rgba(255,255,255,0.28)" />
          <Ellipse cx={78} cy={116} rx={11} ry={7} fill={D.blush} opacity={0.3} />
          <Ellipse cx={162} cy={116} rx={11} ry={7} fill={D.blush} opacity={0.3} />
          {/* 코 */}
          <Path d="M108 112 Q120 104 132 112 Q129 123 120 124 Q111 123 108 112 Z" fill={D.nose} />
          <Ellipse cx={116} cy={110} rx={4.5} ry={2.2} fill="#FFFFFF" opacity={0.45} />
          <Mouth mouth={mood.mouth} />
        </Layer>

        {/* 눈썹 점 — 강아지의 표정 포인트 */}
        <Layer size={size} origin={[120, 82]} style={brows}>
          <Ellipse cx={92} cy={80} rx={7.5} ry={5.5} fill={D.light} opacity={0.95} transform={mood.tear ? "rotate(-16 92 80)" : undefined} />
          <Ellipse cx={148} cy={80} rx={7.5} ry={5.5} fill={D.light} opacity={0.95} transform={mood.tear ? "rotate(16 148 80)" : undefined} />
        </Layer>

        <Layer size={size} origin={[120, 110]} style={eyes}>
          <Ellipse cx={93} cy={98} rx={12} ry={14.5} fill={D.eye} />
          <Ellipse cx={147} cy={98} rx={12} ry={14.5} fill={D.eye} />
          <Ellipse cx={93} cy={105} rx={7.5} ry={6} fill="#8A6A3E" opacity={0.6} />
          <Ellipse cx={147} cy={105} rx={7.5} ry={6} fill="#8A6A3E" opacity={0.6} />
          <Circle cx={97} cy={92} r={4.4} fill="#FFFFFF" />
          <Circle cx={151} cy={92} r={4.4} fill="#FFFFFF" />
          <Circle cx={89} cy={105} r={2.2} fill="#FFFFFF" opacity={0.55} />
          <Circle cx={143} cy={105} r={2.2} fill="#FFFFFF" opacity={0.55} />
        </Layer>

        {mood.tear ? (
          <Layer size={size} style={tear}>
            <Path d="M82 114 Q78 122 82 126 Q87 122 82 114 Z" fill={P.tear} opacity={0.9} />
          </Layer>
        ) : null}

        {showCrown ? (
          <Layer size={size}>
            <Path d="M94 48 L100 22 L113 38 L120 16 L127 38 L140 22 L146 48 Z" fill={P.gold} stroke={P.goldShade} strokeWidth={1.5} strokeLinejoin="round" />
            <Circle cx={120} cy={28} r={2.6} fill={P.heart} />
            <Circle cx={104} cy={36} r={2} fill={P.tear} />
            <Circle cx={136} cy={36} r={2} fill={P.tear} />
          </Layer>
        ) : null}
      </Group>

      {/* 꼬리와 몸 사이 그림자 대신, 마지막에 그릇 쪽을 보는 코 끝 하이라이트는 생략 */}
    </Group>
  );
}

/** 강아지 입 — 혀 내민 웃음 · 낑낑(열림) · 일자 · 시무룩 */
function Mouth({ mouth }: { mouth: "smile" | "open" | "flat" | "frown" }) {
  const line = { stroke: D.mouth, strokeWidth: 2.4, strokeLinecap: "round" as const, fill: "none" };
  switch (mouth) {
    case "smile":
      return (
        <>
          <Path d="M120 124 v6" {...line} />
          <Path d="M120 130 Q108 142 96 130" {...line} />
          <Path d="M120 130 Q132 142 144 130" {...line} />
          {/* 혀 */}
          <Path d="M110 136 Q120 158 130 136 Q120 142 110 136 Z" fill={D.tongue} />
          <Path d="M120 139 v8" stroke="rgba(160,60,80,0.45)" strokeWidth={1.4} strokeLinecap="round" />
        </>
      );
    case "open":
      return (
        <>
          <Path d="M120 124 v4" {...line} />
          <Path d="M108 130 Q120 150 132 130 Z" fill="#7A2F3E" stroke={D.mouth} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M113 141 Q120 147 127 141 Q120 137 113 141 Z" fill={D.tongue} />
        </>
      );
    case "flat":
      return (
        <>
          <Path d="M120 124 v6" {...line} />
          <Path d="M111 135 Q120 131 129 135" {...line} />
        </>
      );
    case "frown":
      return (
        <>
          <Path d="M120 124 v6" {...line} />
          <Path d="M108 140 Q120 128 132 140" {...line} />
        </>
      );
  }
}
