/**
 * AI 분석 탭의 그림 — 데이터와 흐름 상태는 props로만 받는다 (mobile.md "웹 미리보기 — 미리보기 화면").
 * 이 파일은 `api` · `useAuth` · Firebase를 import하지 않는다. 불러오기와 흐름은 app/(app)/(tabs)/analysis.tsx.
 *
 * 순서: 헤더(오늘 상태 · 분석 방법 · 프로필) → 업로드 무대 → 에러 → 둘러보기 타일 → 주간 종합 분석 → 최근 결과 (UIUX 실험 A안)
 */
import { useState } from "react";

import HowToModal from "@/components/analysis/HowToModal";
import RecentResults from "@/components/analysis/RecentResults";
import UploadStage, { type StageKind } from "@/components/analysis/UploadStage";
import WeeklyCard from "@/components/analysis/WeeklyCard";
import BrowseTiles from "@/components/analysis/BrowseTiles";
import CircleButton from "@/components/app/CircleButton";
import ErrorNotice from "@/components/app/ErrorNotice";
import { ProfileIcon } from "@/components/app/HeaderIcons";
import { InfoIcon } from "@/components/app/Icons";
import PageHeader from "@/components/app/PageHeader";
import Screen from "@/components/app/Screen";
import Skeleton from "@/components/app/Skeleton";
import { browseTiles } from "@/logic/browse";
import {
  thisWeekDaily,
  thisWeekWeekly,
  todayDaily,
  weekSlots,
  type AnalysisRecords,
  type UploadState,
  type WeeklyState,
} from "@/logic/analysis";
import { colors } from "@/theme";

export interface AnalysisViewProps {
  /** 오늘 · 이번 주를 가르는 기준 시각 (ms) */
  now: number;
  records: AnalysisRecords | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;

  upload: UploadState;
  onPick: () => void;
  onAnalyze: () => void;
  onCancel: () => void;
  onRetrySave: () => void;
  onReset: () => void;

  weekly: WeeklyState;
  onGenerateWeekly: () => void;
  onRetryWeeklySave: () => void;

  onOpenResult: (analysisId: string) => void;
  /** 둘러보기의 "분석 기록" 타일 */
  onOpenHistory: () => void;
  /** 헤더의 프로필 버튼 (더보기) */
  onOpenProfile: () => void;
}

export default function AnalysisView(props: AnalysisViewProps) {
  const { now, records, loading, error, onRetry, upload, weekly } = props;
  const [howTo, setHowTo] = useState(false);

  const today = records ? todayDaily(records.daily, now) : null;
  const week = records ? thisWeekDaily(records.daily, now) : [];
  const busy = upload.phase === "preparing" || upload.phase === "analyzing" || upload.phase === "saving";

  // 진행 중인 흐름이 먼저다 — 저장 직후 기록을 다시 불러와 "오늘 완료"가 되기 전에도 무대가 흔들리지 않게
  const kind: StageKind = busy
    ? "busy"
    : upload.phase === "save-failed"
      ? "save-failed"
      : today
        ? "done"
        : upload.phase === "picked"
          ? "picked"
          : "idle";

  return (
    <Screen testID="analysis" underTabBar onRefresh={onRetry} refreshing={loading && records !== null}>
      <PageHeader
        eyebrow={records ? (today ? "오늘 분석 완료 · 하루 1회" : "오늘 분석 전 · 하루 1회") : "불러오는 중"}
        title="분석"
        back={false}
        trailing={
          <>
            <CircleButton testID="open-howto" label="분석 방법" onPress={() => setHowTo(true)}>
              <InfoIcon color={colors.textPrimary} size={20} />
            </CircleButton>
            <CircleButton testID="open-profile" label="더보기" onPress={props.onOpenProfile}>
              <ProfileIcon color={colors.textPrimary} size={20} />
            </CircleButton>
          </>
        }
      />

      {records || busy || upload.phase === "save-failed" ? (
        <UploadStage
          kind={kind}
          phase={upload.phase}
          image={upload.imageUri}
          onPick={props.onPick}
          onAnalyze={props.onAnalyze}
          onCancel={props.onCancel}
          onRetrySave={props.onRetrySave}
          onDiscard={props.onReset}
          onOpenToday={() => today && props.onOpenResult(today.id)}
        />
      ) : loading ? (
        <Skeleton testID="stage-skeleton" height={320} radius={28} />
      ) : null}

      {upload.error ? <ErrorNotice testID="upload-error" message={upload.error} /> : null}
      {error ? <ErrorNotice testID="analysis-error" message={error} onRetry={onRetry} /> : null}

      {records || loading ? <BrowseTiles tiles={browseTiles(records, now)} onOpen={props.onOpenHistory} /> : null}

      {records || loading ? (
        <WeeklyCard
          slots={weekSlots(records?.daily ?? [], now)}
          count={week.length}
          doneId={records ? (thisWeekWeekly(records.weekly, now)?.id ?? null) : null}
          weekly={weekly}
          loading={!records}
          onGenerate={props.onGenerateWeekly}
          onRetrySave={props.onRetryWeeklySave}
          onOpenResult={props.onOpenResult}
        />
      ) : null}

      {records ? <RecentResults records={[...week].reverse().slice(0, 3)} now={now} onOpenResult={props.onOpenResult} /> : null}

      <HowToModal visible={howTo} onClose={() => setHowTo(false)} />
    </Screen>
  );
}
