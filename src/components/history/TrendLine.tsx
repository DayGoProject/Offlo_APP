/**
 * 디톡스 점수 추이 — 축도 툴팁도 없는 한 줄짜리 스플라인. 웹 `components/charts/TrendLine.tsx` 이식.
 *
 * 웹은 viewBox를 가로로 늘리고(`preserveAspectRatio="none"`) 마지막 점만 DOM으로 얹는다.
 * 앱은 실제 폭을 재서(onLayout) 좌표를 그 폭으로 계산하므로 늘릴 필요가 없고, 점도 SVG 안에 그린다.
 */
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { colors, fonts } from "@/theme";

const H = 190;
const PAD_Y = 24; // 곡선 위아래가 잘리지 않게
const DOT_R = 4.5;

export interface TrendPoint {
  /** x축 라벨 (예: "9.11") */
  label: string;
  /** 0~100 */
  score: number;
}

/** Catmull-Rom → 3차 베지어 */
function spline(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function TrendLine({ data }: { data: TrendPoint[] }) {
  const [width, setWidth] = useState(0);
  if (data.length < 2) return null;

  // 마지막 점이 오른쪽 끝에서 잘리지 않도록 반지름만큼 안쪽까지만 쓴다
  const usable = Math.max(0, width - DOT_R * 2);
  const pts = data.map((d, i) => ({
    x: DOT_R + (i / (data.length - 1)) * usable,
    y: PAD_Y + (1 - Math.max(0, Math.min(100, d.score)) / 100) * (H - PAD_Y * 2),
  }));
  const last = pts[pts.length - 1];

  // 라벨은 최대 6개 — 많아지면 겹친다
  const step = Math.max(1, Math.ceil(data.length / 6));
  const labels = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <View testID="trend-line" style={styles.wrap}>
      <View
        style={styles.chart}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`디톡스 점수 추이 — 최근 ${data.length}건, 마지막 ${data[data.length - 1].score}점`}
      >
        {width > 0 ? (
          <Svg width={width} height={H}>
            {/* 가로 기준선 3개. 눈금 숫자는 쓰지 않는다 — 값은 목록에서 읽는다 */}
            <Path d={`M0 38H${width}M0 86H${width}M0 134H${width}`} stroke={colors.gridLine} strokeWidth={1} />
            <Path
              testID="trend-path"
              d={spline(pts)}
              fill="none"
              stroke={colors.brand}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Circle cx={last.x} cy={last.y} r={DOT_R} fill={colors.brand} />
          </Svg>
        ) : null}
      </View>

      <View style={styles.labels}>
        {labels.map((d, i) => (
          <Text
            key={`${d.label}-${i}`}
            style={[styles.label, { color: i === labels.length - 1 ? colors.textPrimary : colors.textMuted }]}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  chart: {
    height: H,
    width: "100%",
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    fontFamily: fonts.num,
    fontSize: 11,
    lineHeight: 14,
    fontVariant: ["tabular-nums"],
  },
});
