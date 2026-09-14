/**
 * M2 홈 — 로그인 상태가 유지되는지 확인하는 자리. M4에서 대시보드로 대체된다.
 */
import { useState } from "react";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/auth-context";
import { fonts, shadowCard } from "@/theme";
import { useTheme } from "@/theme-context";

export default function HomeScreen() {
  const { colors: c, scheme } = useTheme();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      // 끝나면 라우트 가드가 로그인 화면으로 넘긴다
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  const name = user?.displayName ?? user?.email ?? "";

  return (
    <View
      testID="home-screen"
      style={[
        styles.screen,
        { backgroundColor: c.bgPage, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Text style={[styles.brandMark, { color: c.brand }]}>Offlo</Text>
      <Text style={[styles.caption, { color: c.textMuted }]}>M2 · 로그인됨</Text>

      <View
        style={[styles.card, shadowCard[scheme], { backgroundColor: c.bgCard, borderColor: c.borderCard }]}
      >
        <Text testID="home-user-name" style={[styles.greeting, { color: c.textPrimary }]}>
          {name}님, 환영합니다
        </Text>
        {user?.email ? (
          <Text style={[styles.email, { color: c.textSecondary }]}>{user.email}</Text>
        ) : null}
        <Text style={[styles.note, { color: c.textFaint }]}>
          앱을 완전히 종료했다가 다시 열어도 이 화면이 보이면 로그인 유지가 동작하는 것입니다.
        </Text>
      </View>

      <Link href="/foundation" asChild>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: c.borderStrong, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.secondaryLabel, { color: c.textPrimarySoft }]}>기반 점검 화면</Text>
        </Pressable>
      </Link>

      <Pressable
        testID="signout-button"
        accessibilityRole="button"
        disabled={signingOut}
        onPress={handleSignOut}
        style={({ pressed }) => [
          styles.secondaryButton,
          { borderColor: c.dangerLine, opacity: signingOut ? 0.6 : pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={[styles.secondaryLabel, { color: c.danger }]}>
          {signingOut ? "로그아웃 중..." : "로그아웃"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 16,
  },
  brandMark: {
    fontFamily: fonts.bold,
    fontSize: 32,
    letterSpacing: -0.5,
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: -10,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    gap: 6,
  },
  greeting: {
    fontFamily: fonts.bold,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  email: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
  },
  secondaryLabel: {
    fontFamily: fonts.medium,
    fontSize: 15,
  },
});
