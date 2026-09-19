/**
 * 디톡스 점수 링 — 웹 결과 페이지의 142px SVG 링 (r=62 · 굵기 10). 12시에서 시계 방향으로 채운다.
 */
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { colors, em, fonts } from "@/theme";

const SIZE = 142;
const R = 62;
const CIRC = 2 * Math.PI * R;

export default function ScoreRing({ score }: { score: number }) {
  const filled = (Math.max(0, Math.min(score, 100)) / 100) * CIRC;
  return (
    <View testID="score-ring" style={styles.ring} accessibilityLabel={`디톡스 점수 ${score}점`}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle cx={71} cy={71} r={R} fill="none" stroke={colors.scoreTrack} strokeWidth={10} />
        <Circle
          testID="score-ring-value"
          cx={71}
          cy={71}
          r={R}
          fill="none"
          stroke={colors.brand}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${CIRC}`}
          transform="rotate(-90 71 71)"
        />
      </Svg>
      <View style={styles.center}>
        <Text testID="score-value" style={styles.score}>
          {score}
        </Text>
        <Text style={styles.label}>디톡스 점수</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  score: {
    fontFamily: fonts.num,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: em(44, -0.04),
    color: colors.textPrimary,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: em(11, 0.08),
    color: colors.textMuted,
  },
});
