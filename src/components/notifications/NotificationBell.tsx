/**
 * 알림 종 — 헤더 모서리의 작은 버튼. 안 읽은 알림이 있으면 숫자 배지(10개부터 "9+")가 붙는다. 터치 영역 44pt.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BellIcon } from "@/components/app/Icons";
import { badgeLabel } from "@/logic/notifications";
import { colors, fonts } from "@/theme";

export default function NotificationBell({ unread, onPress, testID = "notification-bell" }: { unread: number; onPress: () => void; testID?: string }) {
  const label = badgeLabel(unread);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `알림, 읽지 않은 알림 ${unread}개` : "알림"}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1 }]}
    >
      <BellIcon color={colors.textPrimary} />
      {label ? (
        <View testID={`${testID}-badge`} style={styles.badge}>
          <Text style={styles.badgeText}>{label}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgCard,
  },
  badge: {
    position: "absolute",
    top: 3,
    right: 1,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: colors.brand,
  },
  badgeText: {
    fontFamily: fonts.num,
    fontSize: 10,
    lineHeight: 13,
    color: colors.bgPage,
  },
});
