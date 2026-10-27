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
    path: "/preview/goals",
    title: "목표 관리 (더보기 → 목표)",
    states: [
      { state: "ready", label: "진행 중 4 · 완료 2" },
      { state: "empty", label: "첫 사용 (비어 있음)" },
      { state: "loading", label: "불러오는 중" },
      { state: "error", label: "불러오기 실패" },
    ],
  },
  {
    path: "/preview/badges",
    title: "배지 (더보기 → 배지)",
    states: [
      { state: "ready", label: "획득 2 · 잠김 2" },
      { state: "all", label: "모두 획득 (잠긴 배지 없음)" },
      { state: "empty", label: "첫 사용 (획득 없음)" },
      { state: "nostats", label: "진행도를 못 읽음" },
      { state: "loading", label: "불러오는 중" },
      { state: "error", label: "불러오기 실패" },
    ],
  },
  {
    path: "/preview/community",
    title: "커뮤니티 (커뮤니티 탭)",
    states: [
      { state: "ready", label: "피드 25개 (10개씩 세 페이지)" },
      { state: "empty", label: "첫 사용 (글 없음)" },
      { state: "loading", label: "불러오는 중" },
      { state: "error", label: "불러오기 실패" },
      { state: "ranking", label: "주간 랭킹 — 내가 4위" },
      { state: "ranking-outside", label: "주간 랭킹 — Top 10 밖(14위)" },
      { state: "ranking-empty", label: "주간 랭킹 — 아직 없음" },
      { state: "ranking-loading", label: "주간 랭킹 — 불러오는 중" },
      { state: "ranking-error", label: "주간 랭킹 — 불러오기 실패" },
    ],
  },
  {
    path: "/preview/settings",
    title: "설정 (더보기 → 설정)",
    states: [
      { state: "ready", label: "무료 플랜" },
      { state: "premium", label: "프리미엄" },
      { state: "loading", label: "불러오는 중" },
      { state: "error", label: "불러오기 실패" },
    ],
  },
  {
    path: "/preview/blocked",
    title: "차단한 사용자 (설정 → 차단한 사용자)",
    states: [
      { state: "ready", label: "차단 2명" },
      { state: "empty", label: "차단한 사람 없음" },
      { state: "loading", label: "불러오는 중" },
      { state: "error", label: "불러오기 실패" },
    ],
  },
  {
    path: "/preview/notifications",
    title: "알림 (더보기 → 알림 · 홈의 종)",
    states: [
      { state: "ready", label: "안 읽은 3 · 읽은 5" },
      { state: "empty", label: "알림 없음" },
      { state: "loading", label: "불러오는 중" },
      { state: "error", label: "불러오기 실패" },
    ],
  },
  {
    path: "/preview/reminders",
    title: "리마인더 설정 (설정 → 리마인더 알림 · 가짜 기기)",
    states: [
      { state: "undetermined", label: "처음 — 권한을 아직 안 물음" },
      { state: "granted", label: "권한 허용됨" },
      { state: "denied", label: "거절함 — 기기 설정으로" },
      { state: "unsupported", label: "쓸 수 없는 환경 (웹 · Expo Go)" },
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
