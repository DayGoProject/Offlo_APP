/**
 * 48px 원형 배지 아이콘 — 웹 `components/app/BadgeIcon.tsx` 이식.
 *
 * 획득한 배지는 브랜드 그린, 잠긴 배지는 자물쇠 하나로 통일한다 — 잠긴 아이콘을 회색조로 보여 주면 "고장난 것"처럼 읽힌다.
 * 모양(path)은 공유 코드 `ALL_BADGES[].icon`(24 뷰박스)이고 fill 계열과 stroke 계열이 섞여 있다.
 */
import { StyleSheet, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import type { BadgeDef } from "@/shared/badge-utils";
import { colors } from "@/theme";

export default function BadgeIcon({ badge, locked = false }: { badge: BadgeDef; locked?: boolean }) {
  if (locked) {
    return (
      <View style={[styles.circle, { backgroundColor: colors.scoreTrack }]}>
        <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
          <Rect x={4.4} y={8.8} width={11.2} height={7.6} rx={1.8} stroke="rgba(216,216,216,0.3)" strokeWidth={1.4} />
          <Path d="M7 8.8V6.6a3 3 0 0 1 6 0v2.2" stroke="rgba(216,216,216,0.3)" strokeWidth={1.4} />
        </Svg>
      </View>
    );
  }

  const { d, mode, width } = badge.icon;
  return (
    <View style={[styles.circle, { backgroundColor: colors.accentSoft }]}>
      <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path
          d={d}
          fill={mode === "fill" ? colors.brand : "none"}
          stroke={mode === "stroke" ? colors.brand : undefined}
          strokeWidth={width}
          strokeLinecap="round"
          opacity={0.9}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
