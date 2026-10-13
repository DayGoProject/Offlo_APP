/**
 * 축하 연출 층 (M6 6-5) — 방 위에 얹는 2D 층. 빛 번짐(방이 환해짐) · 폭죽/반짝이 입자 · 이름 카드(부화 · 성장).
 * 3D 장면 안이 아니라 React Native 뷰라서 SVG 폴백 · 웹 미리보기에서도 똑같이 보이고, 3D 장면 코드(웹과 공유)를 건드리지 않는다.
 *
 * 모든 움직임은 Reanimated 공유 값(UI 스레드) — 입자마다 진행도 하나(0~1)만 돌리고 자리는 `piecePose`가 계산한다.
 * 터치는 받지 않는다 (아래의 쓰다듬기를 막지 않는다). 시스템 "동작 줄이기"에서는 빛 · 입자를 빼고 카드만 보인다.
 */
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeOut,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { BLOOM_RGB, burstSpec, piecePose, type BurstKind, type BurstSpec, type Piece } from "@/components/garden/art/celebration";
import { colors, fonts, radius } from "@/theme";

export interface Celebration {
  /** 연출마다 다른 번호 — 같은 종류가 이어져도 새로 시작한다 */
  id: number;
  kind: BurstKind;
  /** 이름 카드 (부화 · 성장) */
  card?: { title: string; name: string } | null;
}

/** 방 좌표(360 × 418) 기준 이름 카드 위치 — 동물 · 말풍선 위쪽 */
const CARD_TOP = 26;

export default function CelebrationLayer({
  celebration,
  k,
  onDone,
}: {
  celebration: Celebration;
  /** 방 좌표 → 화면 배율 */
  k: number;
  onDone: (id: number) => void;
}) {
  const reduced = useReducedMotion();
  const spec = useMemo(() => burstSpec(celebration.kind, celebration.id), [celebration.kind, celebration.id]);
  const [cardOn, setCardOn] = useState(Boolean(celebration.card));

  useEffect(() => {
    const done = setTimeout(() => onDone(celebration.id), spec.totalMs);
    const card = spec.cardMs > 0 ? setTimeout(() => setCardOn(false), spec.cardMs) : null;
    return () => {
      clearTimeout(done);
      if (card) clearTimeout(card);
    };
  }, [celebration.id, spec, onDone]);

  return (
    <View testID="celebration" pointerEvents="none" style={StyleSheet.absoluteFill}>
      {!reduced && spec.bloom.peak > 0 ? <Bloom bloom={spec.bloom} /> : null}
      {!reduced ? spec.pieces.map((piece, i) => <PieceView key={i} piece={piece} k={k} />) : null}
      {cardOn && celebration.card ? (
        <View style={[styles.cardSlot, { top: CARD_TOP * k }]}>
          <Animated.View
            testID="celebration-card"
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${celebration.card.title}. ${celebration.card.name}`}
            entering={reduced ? undefined : ZoomIn.duration(280)}
            exiting={FadeOut.duration(260)}
            style={styles.card}
          >
            <Text style={styles.cardTitle}>{celebration.card.title}</Text>
            <Text style={styles.cardName}>{celebration.card.name}</Text>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

/** 방 전체가 따뜻하게 환해졌다 가라앉는다 */
function Bloom({ bloom }: { bloom: BurstSpec["bloom"] }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.set(withSequence(withTiming(bloom.peak, { duration: bloom.inMs }), withTiming(0, { duration: bloom.outMs })));
  }, [opacity, bloom]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View testID="celebration-bloom" style={[StyleSheet.absoluteFill, { backgroundColor: `rgb(${BLOOM_RGB})` }, style]} />;
}

/** 입자 하나 — 진행도 0 → 1만 돌고 자리 · 회전 · 투명도는 `piecePose`가 정한다 */
function PieceView({ piece, k }: { piece: Piece; k: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withDelay(piece.delay, withTiming(1, { duration: piece.duration, easing: Easing.linear })));
  }, [progress, piece]);

  const style = useAnimatedStyle(() => {
    const pose = piecePose(piece, progress.get());
    return {
      opacity: pose.opacity,
      transform: [{ translateX: pose.x * k }, { translateY: pose.y * k }, { rotate: `${pose.rotate}deg` }, { scale: pose.scale }],
    };
  });

  const s = piece.size * k;
  const box = piece.shape === "spark" ? s * 1.7 : s;
  return (
    <Animated.View style={[styles.piece, { width: box, height: box, left: -box / 2, top: -box / 2 }, style]}>
      {piece.shape === "spark" ? (
        <Svg width={box} height={box} viewBox="0 0 24 24">
          <Path
            d="M12 0 C12.8 7.2 16.8 11.2 24 12 C16.8 12.8 12.8 16.8 12 24 C11.2 16.8 7.2 12.8 0 12 C7.2 11.2 11.2 7.2 12 0 Z"
            fill={piece.color}
          />
        </Svg>
      ) : piece.shape === "bar" ? (
        <View style={{ width: box * 0.55, height: box * 1.05, borderRadius: 1.5, backgroundColor: piece.color }} />
      ) : (
        <View style={{ width: box * 0.8, height: box * 0.8, borderRadius: box, backgroundColor: piece.color }} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  piece: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  cardSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  card: {
    alignItems: "center",
    gap: 2,
    minWidth: 150,
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.accentLine,
    backgroundColor: "rgba(14, 17, 22, 0.94)",
  },
  cardTitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  cardName: {
    fontFamily: fonts.semibold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.brand,
  },
});
