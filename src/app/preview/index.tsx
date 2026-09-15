/**
 * 미리보기 목록 — 화면 × 상태 조합으로 연다. 검증 스크립트는 링크 주소로 바로 들어간다.
 */
import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import Card, { CardHeader } from "@/components/app/Card";
import PageHeader from "@/components/app/PageHeader";
import Screen from "@/components/app/Screen";
import { colors, fonts } from "@/theme";

const STATES = [
  { state: "ready", label: "데이터 있음" },
  { state: "empty", label: "첫 사용 (비어 있음)" },
  { state: "loading", label: "불러오는 중" },
  { state: "error", label: "불러오기 실패" },
] as const;

const SCREENS = [
  { path: "/preview/dashboard", title: "대시보드 (홈 탭)" },
  { path: "/preview/history", title: "분석 기록" },
] as const;

export default function PreviewIndex() {
  return (
    <Screen testID="preview-index">
      <PageHeader eyebrow="검증 층 ① · 샘플 값" title="미리보기" />
      {SCREENS.map((screen) => (
        <Card key={screen.path}>
          <CardHeader title={screen.title} />
          {STATES.map(({ state, label }) => (
            <Link key={state} href={`${screen.path}?state=${state}` as Href} asChild>
              <Pressable style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </Link>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  chevron: {
    fontFamily: fonts.regular,
    fontSize: 20,
    color: colors.textMuted,
  },
});
