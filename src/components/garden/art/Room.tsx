/**
 * 방 배경 — 밤 창가의 아늑한 방. 창밖 하늘은 KST 시간대(새벽 · 낮 · 저녁 · 밤)를 따라 바뀐다.
 * 좌표는 360 × 418 단위 (viewBox) — 실제 크기에 맞게 늘어난다. 동물 · 화분 · 그릇은 이 위에 겹쳐 놓인다.
 *
 * 램프 빛은 RadialGradient가 아니라 **반투명 타원을 겹쳐서** 만든다 (RN Web에서 방사형이 사각 경계를 보인다 — design.md).
 */
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import type { DayPart } from "@/logic/scene";

import { useGradId } from "./Layer";
import { useEased, useMotionEnabled, useOscillator } from "./motion";
import { room as R, sky as S } from "./palette";

/** 방의 좌표계 — 장면 컴포넌트가 같은 값으로 동물 · 화분 위치를 계산한다 */
const GLOW = Array.from({ length: 12 }, (_, i) => [176 - i * 11, 154 - i * 10] as const);
const POOL = Array.from({ length: 8 }, (_, i) => [156 - i * 13, 37 - i * 3.6] as const);

export const ROOM_W = 360;
export const ROOM_H = 418;

const STARS: readonly [number, number, number][] = [
  [140, 74, 1.6],
  [158, 96, 1.2],
  [196, 70, 1.8],
  [214, 104, 1.2],
  [150, 134, 1.4],
  [222, 132, 1.6],
  [176, 150, 1.1],
  [204, 88, 1],
];

export default function Room({
  width,
  height,
  dayPart,
  animate = true,
  dim = 0,
}: {
  width: number;
  height: number;
  dayPart: DayPart;
  animate?: boolean;
  /** 0~1 — 동물이 굶주리면 방이 서늘하게 가라앉는다 (램프도 힘이 빠진다) */
  dim?: number;
}) {
  const id = useGradId("room");
  const enabled = useMotionEnabled(animate);
  const twinkle = useOscillator(3200, enabled);
  const twinkle2 = useOscillator(4100, enabled, 900);
  const drift = useOscillator(16000, enabled);
  const lampFlicker = useOscillator(5200, enabled, 300);

  const starsA = useAnimatedStyle(() => ({ opacity: 0.75 + twinkle.get() * 0.25 }));
  const starsB = useAnimatedStyle(() => ({ opacity: 0.6 + twinkle2.get() * 0.4 }));
  const cloud = useAnimatedStyle(() => ({ transform: [{ translateX: drift.get() * 10 * (width / ROOM_W) }] }));
  const dimmed = useEased(dim, enabled, 900);
  const lamp = useAnimatedStyle(() => ({ opacity: (0.94 + lampFlicker.get() * 0.06) * (1 - dimmed.get() * 0.45) }));
  const cold = useAnimatedStyle(() => ({ opacity: dimmed.get() }));

  const sky = S[dayPart];
  const isNight = dayPart === "night";
  const fill = StyleSheet.absoluteFill;
  const frame = { position: "absolute" as const, left: 0, top: 0, width, height };

  return (
    <>
      {/* 고정 배경: 벽 · 창 · 바닥 · 러그 · 탁자 · 램프 기둥 */}
      <Svg width={width} height={height} viewBox={`0 0 ${ROOM_W} ${ROOM_H}`} style={fill}>
        <Defs>
          <LinearGradient id={`${id}wall`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={R.wallTop} />
            <Stop offset="1" stopColor={R.wallBottom} />
          </LinearGradient>
          <LinearGradient id={`${id}floor`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={R.floorTop} />
            <Stop offset="1" stopColor={R.floorBottom} />
          </LinearGradient>
          <LinearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={sky.top} />
            <Stop offset="1" stopColor={sky.bottom} />
          </LinearGradient>
          <GlassClip id={`${id}glass`} />
        </Defs>

        {/* 벽 */}
        <Rect x={0} y={0} width={ROOM_W} height={304} fill={`url(#${id}wall)`} />
        <Rect x={0} y={236} width={ROOM_W} height={3} fill="rgba(255,255,255,0.045)" />
        <Rect x={0} y={239} width={ROOM_W} height={65} fill="rgba(0,0,0,0.12)" />

        {/* 커튼 (창 뒤) */}
        <Path d="M78 30 Q98 96 90 196 L122 196 L122 30 Z" fill={R.curtain} />
        <Path d="M96 34 Q112 100 108 196" stroke={R.curtainShade} strokeWidth={5} fill="none" opacity={0.7} />
        <Path d="M278 30 Q258 96 266 196 L234 196 L234 30 Z" fill={R.curtain} />
        <Path d="M260 34 Q244 100 248 196" stroke={R.curtainShade} strokeWidth={5} fill="none" opacity={0.7} />

        {/* 창틀 · 하늘 */}
        <Path d="M116 182 L116 106 Q116 52 178 52 Q240 52 240 106 L240 182 Z" fill={R.frame} />
        <Path d="M123 178 L123 106 Q123 60 178 60 Q233 60 233 106 L233 178 Z" fill={`url(#${id}sky)`} />
        <G clipPath={`url(#${id}glass)`}>
          {isNight ? <Moon /> : <Sun dayPart={dayPart} />}
        </G>
        {/* 창살 · 유리 반사 */}
        <Path d="M178 60 V178 M123 118 H233" stroke={R.frame} strokeWidth={5} />
        {isNight ? null : <Path d="M123 178 L123 106 Q123 60 178 60 Q233 60 233 106 L233 178 Z" fill="rgba(10,16,40,0.2)" />}
        <Path d="M133 168 L133 112 Q133 76 160 68" stroke="rgba(255,255,255,0.22)" strokeWidth={3} strokeLinecap="round" fill="none" />
        <Rect x={108} y={178} width={140} height={9} rx={3} fill={R.sill} />

        {/* 바닥 */}
        <Rect x={0} y={304} width={ROOM_W} height={ROOM_H - 304} fill={`url(#${id}floor)`} />
        <Rect x={0} y={298} width={ROOM_W} height={8} fill={R.baseboard} />
        <G stroke={R.plank} strokeWidth={1.4}>
          <Path d="M0 328 H360 M0 356 H360 M0 388 H360" />
          <Path d="M64 306 V328 M212 306 V328 M300 306 V328 M30 328 V356 M150 328 V356 M262 328 V356 M96 356 V388 M226 356 V388 M330 356 V388 M40 388 V418 M180 388 V418 M290 388 V418" />
        </G>
        <Rect x={0} y={306} width={ROOM_W} height={22} fill={R.plankLight} />

        {/* 러그 */}
        <Ellipse cx={190} cy={376} rx={140} ry={33} fill={R.rug} />
        <Ellipse cx={190} cy={376} rx={120} ry={26} fill="none" stroke={R.rugRing} strokeWidth={2} />
        <Ellipse cx={190} cy={376} rx={98} ry={19} fill="none" stroke={R.rugRingSoft} strokeWidth={1.5} />

        {/* 화분 탁자 */}
        <Rect x={30} y={300} width={5} height={30} fill={R.stool} />
        <Rect x={77} y={300} width={5} height={30} fill={R.stool} />
        <Ellipse cx={56} cy={298} rx={44} ry={8.5} fill={R.stoolTop} />
        <Ellipse cx={56} cy={296.5} rx={44} ry={7} fill="rgba(255,255,255,0.06)" />

        {/* 램프 기둥 · 받침 */}
        <Rect x={316} y={180} width={4} height={132} fill={R.lampPole} />
        <Ellipse cx={318} cy={313} rx={19} ry={5.5} fill={R.lampPole} />
      </Svg>

      {/* 창밖 별 · 구름 — 천천히 움직인다 */}
      {isNight ? (
        <>
          <Animated.View pointerEvents="none" style={[frame, starsA]}>
            <Svg width={width} height={height} viewBox={`0 0 ${ROOM_W} ${ROOM_H}`} style={fill}>
              <Defs>
                <GlassClip id={`${id}glass`} />
              </Defs>
              <G clipPath={`url(#${id}glass)`}>
                {STARS.filter((_, i) => i % 2 === 0).map(([x, y, r], i) => (
                  <Circle key={i} cx={x} cy={y} r={r} fill={S.star} />
                ))}
              </G>
            </Svg>
          </Animated.View>
          <Animated.View pointerEvents="none" style={[frame, starsB]}>
            <Svg width={width} height={height} viewBox={`0 0 ${ROOM_W} ${ROOM_H}`} style={fill}>
              <Defs>
                <GlassClip id={`${id}glass`} />
              </Defs>
              <G clipPath={`url(#${id}glass)`}>
                {STARS.filter((_, i) => i % 2 === 1).map(([x, y, r], i) => (
                  <Circle key={i} cx={x} cy={y} r={r} fill={S.star} />
                ))}
              </G>
            </Svg>
          </Animated.View>
        </>
      ) : (
        <Animated.View pointerEvents="none" style={[frame, cloud]}>
          <Svg width={width} height={height} viewBox={`0 0 ${ROOM_W} ${ROOM_H}`} style={fill}>
            <Defs>
              <GlassClip id={`${id}glass`} />
            </Defs>
            <G clipPath={`url(#${id}glass)`}>
              <Ellipse cx={168} cy={128} rx={20} ry={7} fill={S.cloud} />
              <Ellipse cx={184} cy={122} rx={14} ry={8} fill={S.cloud} />
              <Ellipse cx={200} cy={129} rx={16} ry={6} fill={S.cloud} />
            </G>
          </Svg>
        </Animated.View>
      )}

      {/* 램프 갓 · 빛 번짐 */}
      <Animated.View pointerEvents="none" style={[frame, lamp]}>
        <Svg width={width} height={height} viewBox={`0 0 ${ROOM_W} ${ROOM_H}`} style={fill}>
          <G>
            {/* 빛 — 촘촘한 타원 여러 겹 (겹이 적으면 동심원 띠가 보인다) */}
            {GLOW.map(([rx, ry], i) => (
              <Ellipse key={i} cx={318} cy={186} rx={rx} ry={ry} fill={`rgba(${R.lampGlow}, 0.016)`} />
            ))}
            {/* 바닥에 떨어지는 빛 웅덩이 */}
            {POOL.map(([rx, ry], i) => (
              <Ellipse key={i} cx={246} cy={378} rx={rx} ry={ry} fill={`rgba(${R.lampGlow}, 0.02)`} />
            ))}
            {/* 갓 */}
            <Path d="M294 180 L342 180 L332 140 L304 140 Z" fill={R.lampShade} />
            <Path d="M294 180 L342 180 L340 172 L296 172 Z" fill={R.lampShadeShade} />
            <Ellipse cx={318} cy={182} rx={11} ry={4.5} fill={R.lampBulb} />
          </G>
        </Svg>
      </Animated.View>

      {/* 굶주림 — 서늘하게 가라앉은 방 */}
      <Animated.View pointerEvents="none" style={[frame, cold]}>
        <Svg width={width} height={height} viewBox={`0 0 ${ROOM_W} ${ROOM_H}`} style={fill}>
          <Rect x={0} y={0} width={ROOM_W} height={ROOM_H} fill="rgba(10, 18, 44, 0.34)" />
        </Svg>
      </Animated.View>

      {/* 위 · 아래 가장자리를 어둡게 — 카드 테두리로 자연스럽게 이어진다 */}
      <Svg width={width} height={height} viewBox={`0 0 ${ROOM_W} ${ROOM_H}`} style={fill} pointerEvents="none">
        <Defs>
          <LinearGradient id={`${id}vt`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={`rgb(${R.vignette})`} stopOpacity={0.6} />
            <Stop offset="1" stopColor={`rgb(${R.vignette})`} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id={`${id}vb`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={`rgb(${R.vignette})`} stopOpacity={0} />
            <Stop offset="1" stopColor={`rgb(${R.vignette})`} stopOpacity={0.55} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={ROOM_W} height={90} fill={`url(#${id}vt)`} />
        <Rect x={0} y={ROOM_H - 70} width={ROOM_W} height={70} fill={`url(#${id}vb)`} />
      </Svg>
    </>
  );
}

/** 창 유리 모양 — 하늘 · 별 · 구름을 이 안에서만 보이게 자른다 */
function GlassClip({ id }: { id: string }) {
  return (
    <ClipPath id={id}>
      <Path d="M123 178 L123 106 Q123 60 178 60 Q233 60 233 106 L233 178 Z" />
    </ClipPath>
  );
}

function Moon() {
  return (
    <>
      <Circle cx={198} cy={98} r={26} fill="rgba(255,241,196,0.10)" />
      <Circle cx={198} cy={98} r={20} fill="rgba(255,241,196,0.16)" />
      <Circle cx={198} cy={98} r={14} fill={S.moon} />
      <Circle cx={193} cy={95} r={3.2} fill={S.moonShade} opacity={0.6} />
      <Circle cx={203} cy={103} r={2.4} fill={S.moonShade} opacity={0.55} />
    </>
  );
}

function Sun({ dayPart }: { dayPart: DayPart }) {
  // 낮엔 높이, 새벽 · 저녁엔 창 아래쪽 (수평선 가까이)
  const y = dayPart === "day" ? 92 : 156;
  return (
    <>
      <Circle cx={196} cy={y} r={32} fill="rgba(255,228,154,0.16)" />
      <Circle cx={196} cy={y} r={22} fill="rgba(255,228,154,0.26)" />
      <Circle cx={196} cy={y} r={14} fill={S.sun} />
    </>
  );
}
