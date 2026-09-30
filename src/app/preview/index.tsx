/**
 * 미리보기 목록 — 화면 × 상태 조합으로 연다. 검증 스크립트는 링크 주소로 바로 들어간다.
 */
import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import Card, { CardHeader } from "@/components/app/Card";
import PageHeader from "@/components/app/PageHeader";
import Screen from "@/components/app/Screen";
import { colors, fonts } from "@/theme";

const BASIC = [
  { state: "ready", label: "데이터 있음" },
  { state: "empty", label: "첫 사용 (비어 있음)" },
  { state: "loading", label: "불러오는 중" },
  { state: "error", label: "불러오기 실패" },
] as const;

const SCREENS: { path: string; title: string; states: readonly { state: string; label: string }[] }[] = [
  { path: "/preview/dashboard", title: "대시보드 (홈 탭)", states: BASIC },
  { path: "/preview/history", title: "분석 기록", states: BASIC },
  {
    path: "/preview/analysis",
    title: "AI 분석 (분석 탭)",
    states: [
      { state: "ready", label: "오늘 분석 전" },
      { state: "picked", label: "사진을 고름" },
      { state: "analyzing", label: "분석 중" },
      { state: "save-failed", label: "저장만 실패" },
      { state: "done", label: "오늘 분석 완료" },
      { state: "weekly", label: "주간 분석 열림 (7/7)" },
      { state: "empty", label: "첫 사용 (비어 있음)" },
      { state: "loading", label: "불러오는 중" },
      { state: "error", label: "불러오기 실패" },
    ],
  },
  {
    path: "/preview/result",
    title: "분석 결과",
    states: [
      { state: "ready", label: "일간 (시간대 패턴 있음)" },
      { state: "free", label: "시간대 패턴 없음" },
      { state: "weekly", label: "주간" },
      { state: "loading", label: "불러오는 중" },
      { state: "error", label: "불러오기 실패" },
    ],
  },
  {
    path: "/preview/garden",
    title: "정원 (정원 탭)",
    states: [
      { state: "fed", label: "배부름 — 오늘 분석함" },
      { state: "peckish", label: "출출함 — 어제까지 이어짐" },
      { state: "starving", label: "굶주림 — 연속 기록이 끊김" },
      { state: "egg", label: "알 — 분석 기록 없음" },
      { state: "none", label: "동물 미선택" },
      { state: "legend", label: "마지막 단계 (전설 · 고목나무)" },
      { state: "save-error", label: "동물 저장 실패", },
      { state: "loading", label: "불러오는 중" },
      { state: "error", label: "불러오기 실패" },
    ],
  },
  {
    path: "/preview/chat",
    title: "AI 코치 채팅",
    states: [
      { state: "ready", label: "대화 중" },
      { state: "sending", label: "답 기다리는 중" },
      { state: "send-error", label: "보내기 실패 (사진 첨부)" },
      { state: "loading", label: "불러오는 중" },
      { state: "error", label: "불러오기 실패" },
    ],
  },
];

export default function PreviewIndex() {
  return (
    <Screen testID="preview-index">
      <PageHeader eyebrow="검증 층 ① · 샘플 값" title="미리보기" />
      {SCREENS.map((screen) => (
        <Card key={screen.path}>
          <CardHeader title={screen.title} />
          {screen.states.map(({ state, label }) => (
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
