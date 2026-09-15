/**
 * 더보기 — 웹 사이드바에서 탭에 들지 못한 메뉴(기록 · 목표 · 배지 · 설정)와 계정.
 * "내 계정" 카드는 서버의 내 정보를 읽는다 — M3의 네트워크 실패 안내를 확인하는 자리이기도 하다.
 */
import { useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/auth-context";
import Card, { CardHeader } from "@/components/app/Card";
import ErrorNotice from "@/components/app/ErrorNotice";
import PageHeader from "@/components/app/PageHeader";
import Screen from "@/components/app/Screen";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/services/api";
import { fmtDate } from "@/shared/format";
import { colors, fonts } from "@/theme";

export default function MoreTab() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const profile = useApiQuery((signal) => api.users.me(signal));
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

  return (
    <Screen testID="more-tab" underTabBar onRefresh={profile.reload} refreshing={profile.loading && profile.data !== null}>
      <PageHeader eyebrow={user?.email ?? undefined} title="더보기" />

      <Card testID="account-card">
        <CardHeader title="내 계정" />
        {profile.data ? (
          <View testID="account-profile">
            <InfoRow label="이름" value={profile.data.user.name} />
            <InfoRow label="가입일" value={fmtDate(profile.data.user.createdAt)} />
            <InfoRow label="플랜" value={profile.data.user.premium ? "프리미엄" : "무료 플랜"} last />
          </View>
        ) : null}
        {profile.loading && !profile.data ? <ActivityIndicator color={colors.brand} /> : null}
        {profile.error ? <ErrorNotice testID="account-error" message={profile.error} onRetry={profile.reload} /> : null}
      </Card>

      <Card style={styles.menuCard}>
        <MenuRow label="분석 기록" onPress={() => router.push("/history")} testID="menu-history" />
        <MenuRow label="목표" badge="M7" />
        <MenuRow label="배지" badge="M7" />
        <MenuRow label="설정" badge="M7" last />
      </Card>

      <Card style={styles.menuCard}>
        <MenuRow
          label={signingOut ? "로그아웃 중..." : "로그아웃"}
          tone="danger"
          onPress={signingOut ? undefined : handleSignOut}
          testID="signout-button"
          last
        />
      </Card>
    </Screen>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.divider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function MenuRow({
  label,
  onPress,
  badge,
  tone = "default",
  last = false,
  testID,
}: {
  label: string;
  onPress?: () => void;
  /** 아직 열리지 않은 메뉴 — 해당 단계 표시 */
  badge?: string;
  tone?: "default" | "danger";
  last?: boolean;
  testID?: string;
}) {
  const enabled = Boolean(onPress);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, !last && styles.divider, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Text
        style={[
          styles.menuLabel,
          { color: tone === "danger" ? colors.danger : enabled ? colors.textPrimary : colors.textFaint },
        ]}
      >
        {label}
      </Text>
      {badge ? <Text style={styles.badge}>{badge}에서 열려요</Text> : enabled ? <Text style={styles.chevron}>›</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  menuCard: {
    paddingVertical: 4,
    gap: 0,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderCard,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  infoLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  menuRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  menuLabel: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  badge: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textFaint,
  },
  chevron: {
    fontFamily: fonts.regular,
    fontSize: 20,
    color: colors.textMuted,
  },
});
