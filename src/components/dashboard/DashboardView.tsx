/**
 * 대시보드 화면의 그림 — 데이터는 props로만 받는다 (mobile.md "웹 미리보기 — 미리보기 화면").
 *
 * `app/(app)/(tabs)/index.tsx` 는 API로 불러와 넘기고, `app/preview/dashboard.tsx` 는 샘플 값을 넘긴다.
 * 그래서 이 파일은 `api` · `useAuth` · Firebase를 import하지 않는다.
 */
import { StyleSheet, View } from "react-native";

import Card, { CardHeader } from "@/components/app/Card";
import ErrorNotice from "@/components/app/ErrorNotice";
import PageHeader from "@/components/app/PageHeader";
import Pill from "@/components/app/Pill";
import Screen from "@/components/app/Screen";
import Skeleton from "@/components/app/Skeleton";
import AiTip from "@/components/dashboard/AiTip";
import GardenCard from "@/components/dashboard/GardenCard";
import GoalProgressList from "@/components/dashboard/GoalProgressList";
import Stat, { StatGrid } from "@/components/dashboard/Stat";
import WeekBars from "@/components/dashboard/WeekBars";
import { buildWeek, screenTimeNote, todayAndYesterday, weekAverage } from "@/logic/dashboard";
import type { AnalysisSummary, GardenSnapshot, Goal } from "@/services/api-types";
import { fmt, fmtDateEyebrow, fmtHM } from "@/shared/format";
import { ANIMAL_STAGES, getAnimalStage, getPlantLevel, nextPlantLevel } from "@/shared/garden-utils";
import { colors } from "@/theme";

export interface DashboardData {
  analyses: AnalysisSummary[];
  goals: Goal[];
  garden: GardenSnapshot;
  /** 최신 분석의 추천 첫 줄 — 없으면 카드를 그리지 않는다 */
  tip: string | null;
}

export interface DashboardViewProps {
  /** 인사말에 쓸 이름 (firstName) */
  name: string;
  now: Date;
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenHistory: () => void;
  onOpenAnalysis: () => void;
  onOpenGoals: () => void;
  onOpenGarden: () => void;
}

const grouped = (n: number) => n.toLocaleString("ko-KR");

export default function DashboardView({
  name,
  now,
  data,
  loading,
  error,
  onRetry,
  onOpenHistory,
  onOpenAnalysis,
  onOpenGoals,
  onOpenGarden,
}: DashboardViewProps) {
  const actions = (
    <>
      <Pill label="기록 보기" onPress={onOpenHistory} testID="open-history" />
      <Pill label="오늘 분석하기" variant="primary" onPress={onOpenAnalysis} testID="open-analysis" />
    </>
  );

  // 처음 불러오다 실패 — 보여줄 숫자가 없다
  if (!data && error && !loading) {
    return (
      <Screen testID="dashboard" underTabBar onRefresh={onRetry}>
        <PageHeader eyebrow={fmtDateEyebrow(now)} title={`${name}님, 안녕하세요`} actions={actions} />
        <ErrorNotice testID="dashboard-error" message={error} onRetry={onRetry} />
      </Screen>
    );
  }

  const analyses = data?.analyses ?? [];
  const { today, yesterday } = todayAndYesterday(analyses, now);
  const note = screenTimeNote(today, yesterday);

  const streak = data?.garden.animal?.streak ?? 0;
  const stage = getAnimalStage(streak);
  const nextStage = ANIMAL_STAGES.find((s) => s.minStreak > streak) ?? null;

  const detox = data?.garden.totalDetoxMinutes ?? 0;
  const plant = getPlantLevel(detox);
  const nextPlant = nextPlantLevel(plant);

  const week = buildWeek(analyses, now);
  const { recordedDays, averageMinutes } = weekAverage(week);
  const goals = data?.goals ?? [];
  const ready = data !== null;

  return (
    <Screen testID="dashboard" underTabBar refreshing={loading && ready} onRefresh={onRetry}>
      <PageHeader
        eyebrow={fmtDateEyebrow(now)}
        title={streak > 0 ? `${streak}일째, 잘 버티고 있어요` : `${name}님, 오늘부터 시작해요`}
        actions={actions}
      />

      {/* 새로고침만 실패 — 이전 숫자는 남기고 위에 알린다 */}
      {ready && error ? <ErrorNotice testID="dashboard-error" message={error} onRetry={onRetry} /> : null}

      <StatGrid>
        <Stat
          testID="stat-screentime"
          label="오늘 스크린타임"
          value={ready && today ? fmtHM(today.totalMinutes) : "—"}
          note={ready ? note.text : undefined}
          noteTone={note.tone}
        />
        <Stat
          testID="stat-score"
          label="디톡스 점수"
          value={ready && today ? String(today.detoxScore) : "—"}
          progress={today ? today.detoxScore / 100 : 0}
        />
        <Stat
          testID="stat-streak"
          label="연속 기록"
          value={ready ? String(streak) : "—"}
          unit="일째"
          note={
            ready
              ? nextStage
                ? `${nextStage.minStreak}일이면 ${nextStage.name}가 돼요`
                : `${stage.name} 단계에 도달했어요`
              : undefined
          }
        />
        <Stat
          testID="stat-detox"
          label="누적 디톡스"
          value={ready ? grouped(detox) : "—"}
          unit="분"
          note={
            ready
              ? nextPlant
                ? `${plant.name} · 다음까지 ${grouped(nextPlant.minMinutes - detox)}분`
                : `${plant.name} · 최고 단계`
              : undefined
          }
        />
      </StatGrid>

      <Card testID="week-card">
        <CardHeader
          title="이번 주 스크린타임"
          right={!ready ? "—" : recordedDays ? `일 평균 ${fmt(averageMinutes)}` : "기록 없음"}
        />
        {ready ? <WeekBars data={week} /> : <Skeleton testID="week-skeleton" height={200} />}

        <View style={styles.divider} />

        <CardHeader
          title="진행 중인 목표"
          right={!ready ? "—" : goals.length ? `${goals.length}개` : "목표 만들기 →"}
          rightTone={ready && goals.length === 0 ? "brand" : "muted"}
          onPressRight={ready ? onOpenGoals : undefined}
        />
        {ready ? <GoalProgressList goals={goals} now={now} /> : <Skeleton testID="goals-skeleton" height={20} />}

        {data?.tip ? <AiTip text={data.tip} /> : null}
      </Card>

      {ready ? (
        <GardenCard totalDetoxMinutes={detox} onOpenGarden={onOpenGarden} />
      ) : (
        <Card>
          <CardHeader title="반려 정원" />
          <Skeleton testID="garden-skeleton" height={260} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    backgroundColor: colors.borderCard,
  },
});
