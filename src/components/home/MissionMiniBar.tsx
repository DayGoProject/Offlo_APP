/**
 * 미션 미니 바 — 탭바 바로 위에 계속 떠 있는 한 줄 (UIUX 실험 A안, 레퍼런스의 하단 미니 플레이어).
 * 오늘 미션(밥 · 쓰다듬기)이 몇 개 끝났고 다음에 뭘 하면 되는지 보여 주고, 누르면 정원 탭으로 간다. props만 받는다.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { CheckIcon } from "@/components/app/Icons";
import type { MiniMission } from "@/logic/home";
import { colors, fonts, radius } from "@/theme";

const RING = 40;
const STROKE = 4;

export default function MissionMiniBar({ mission, emoji, onPress }: { mission: MiniMission; emoji: string; onPress: () => void }) {
  const r = (RING - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const ratio = mission.total > 0 ? mission.done / mission.total : 0;
  return (
    <Pressable
      testID="mission-mini-bar"
      accessibilityRole="button"
      accessibilityLabel={`${mission.title}. ${mission.sub}. 정원에서 보기`}
      onPress={onPress}
      style={({ pressed }) => [styles.bar, { opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={styles.handle} />
      <View style={styles.thumb}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <View style={styles.text}>
        <Text numberOfLines={1} style={styles.title}>
          {mission.title}
        </Text>
        <Text testID="mini-mission-sub" numberOfLines={1} style={styles.sub}>
          {mission.sub}
        </Text>
      </View>
      <View style={styles.ringBox}>
        <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
          <Circle cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke={colors.bgBar} strokeWidth={STROKE} />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            fill="none"
            stroke={colors.brand}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${c * ratio} ${c}`}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <View style={styles.ringCenter}>{mission.allDone ? <CheckIcon color={colors.brand} size={18} /> : <Text style={styles.ringText}>{mission.done}/{mission.total}</Text>}</View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 84,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 30, // 아래 26은 탭바의 + 버튼이 솟아 올라와 겹치는 자리 — 글자가 그 위에 오도록
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgNav,
  },
  handle: {
    position: "absolute",
    top: 6,
    alignSelf: "center",
    left: "50%",
    marginLeft: -16,
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textGhost,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  emoji: {
    fontSize: 24,
  },
  text: {
    flex: 1,
    gap: 2,
    paddingRight: 56, // 가운데 + 버튼이 솟아 올라오는 자리를 피한다
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  ringBox: {
    width: RING,
    height: RING,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  ringText: {
    fontFamily: fonts.num,
    fontSize: 11,
    color: colors.textPrimarySoft,
  },
});
