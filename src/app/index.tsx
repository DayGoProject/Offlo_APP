/**
 * 임시 홈 — 로그인 유지(M2)와 서버 연결 · 네트워크 실패 안내(M3)를 확인하는 자리.
 * M4에서 대시보드로 대체된다.
 */
import { useState } from "react";
import { Link } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/auth-context";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/services/api";
import { fmtDate } from "@/shared/format";
import { fonts, shadowCard } from "@/theme";
import { useTheme } from "@/theme-context";

export default function HomeScreen() {
  const { colors: c, scheme } = useTheme();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [signingOut, setSigningOut] = useState(false);
  const profile = useApiQuery((signal) => api.users.me(signal));

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
      <Text style={[styles.caption, { color: c.textMuted }]}>M3 · 로그인 · 서버 연결</Text>

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

      <View
        testID="home-server-card"
        style={[styles.card, shadowCard[scheme], { backgroundColor: c.bgCard, borderColor: c.borderCard }]}
      >
        <Text style={[styles.cardTitle, { color: c.textMuted }]}>서버의 내 정보</Text>

        {profile.data ? (
          <View testID="home-server-profile">
            <Row label="이름" value={profile.data.user.name} labelColor={c.textSecondary} valueColor={c.textPrimary} />
            <Row
              label="가입일"
              value={fmtDate(profile.data.user.createdAt)}
              labelColor={c.textSecondary}
              valueColor={c.textPrimary}
            />
            <Row
              label="요금제"
              value={profile.data.user.premium ? "프리미엄" : "무료"}
              labelColor={c.textSecondary}
              valueColor={c.textPrimary}
            />
          </View>
        ) : null}

        {profile.loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={c.brand} />
            <Text style={[styles.note, styles.noteInline, { color: c.textSecondary }]}>불러오는 중…</Text>
          </View>
        ) : null}

        {profile.error ? (
          <View
            testID="home-server-error"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.errorBox, { backgroundColor: c.dangerSoft, borderColor: c.dangerLine }]}
          >
            <Text style={[styles.errorText, { color: c.danger }]}>{profile.error}</Text>
          </View>
        ) : null}

        {!profile.loading && profile.error ? (
          <Pressable
            testID="home-retry-button"
            accessibilityRole="button"
            onPress={profile.reload}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: c.borderStrong, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.secondaryLabel, { color: c.textPrimarySoft }]}>다시 시도</Text>
          </Pressable>
        ) : null}
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

function Row({
  label,
  value,
  labelColor,
  valueColor,
}: {
  label: string;
  value: string;
  labelColor: string;
  valueColor: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor }]}>{value}</Text>
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
  noteInline: {
    marginTop: 0,
  },
  cardTitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    gap: 12,
  },
  rowLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  rowValue: {
    fontFamily: fonts.medium,
    fontSize: 14,
    flexShrink: 1,
    textAlign: "right",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
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
