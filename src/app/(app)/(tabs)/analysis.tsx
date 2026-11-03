/**
 * AI 분석 탭 — 불러오기와 흐름만 여기서, 그리기는 AnalysisView가 한다.
 *
 * 불러오는 것: 최근 일간 7건(이번 주 7칸 · 주간 요약의 앱별 시간) + 최근 주간 1건(이번 주 주간 분석 여부)
 * 하루 1회라 최근 일간 7건이면 이번 주(월~일)가 전부 들어온다.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import AnalysisView from "@/components/analysis/AnalysisView";
import { notifyAnalysesChanged, useAnalysesChanged } from "@/hooks/analyses-changed";
import { useApiQuery } from "@/hooks/use-api-query";
import { useDailyAnalysis, useWeeklyAnalysis } from "@/hooks/use-analysis-flow";
import { thisWeekDaily, todayDaily, WEEKLY_THRESHOLD, type AnalysisRecords } from "@/logic/analysis";
import { api } from "@/services/api";

export default function AnalysisTab() {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  const records = useApiQuery<AnalysisRecords>(async (signal) => {
    const [daily, weekly] = await Promise.all([
      api.analyses.list({ periodType: "daily", limit: WEEKLY_THRESHOLD, includeApps: true }, signal),
      api.analyses.list({ periodType: "weekly", limit: 1 }, signal),
    ]);
    return { daily: daily.analyses, weekly: weekly.analyses };
  });
  useAnalysesChanged(records.reload);

  // 탭에 돌아올 때마다 다시 본다 — 다른 기기(웹)에서 분석했거나 자정이 지났을 수 있다. 첫 포커스는 위 불러오기가 한다
  const reload = records.reload;
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) {
        setNow(Date.now());
        reload();
      }
      focusedOnce.current = true;
    }, [reload]),
  );

  const openResult = (id: string) => router.push({ pathname: "/result/[id]", params: { id } });
  const saved = (id: string) => {
    notifyAnalysesChanged();
    openResult(id);
  };

  const daily = useDailyAnalysis({ onSaved: saved, onAlreadyDone: notifyAnalysesChanged });
  const weekly = useWeeklyAnalysis({ onSaved: saved });

  // 홈의 "오늘 분석하기" · 가운데 + 버튼(`?start=pick`)이 오면 사진 고르기를 바로 연다 — 엄지 한 번으로 올리기까지.
  // 기록을 읽은 뒤에 판단한다(오늘 이미 분석했으면 열지 않는다). 한 번 처리하면 주소의 표식을 지워 다음에 또 올 수 있다
  const { start } = useLocalSearchParams<{ start?: string }>();
  const startHandled = useRef(false);
  const pickDaily = daily.pick;
  const loaded = records.data;
  useEffect(() => {
    if (start !== "pick") {
      startHandled.current = false;
      return;
    }
    if (!loaded || startHandled.current) return;
    startHandled.current = true;
    router.setParams({ start: undefined });
    if (!todayDaily(loaded.daily, Date.now())) pickDaily();
  }, [start, loaded, pickDaily, router]);

  return (
    <AnalysisView
      now={now}
      records={records.data}
      loading={records.loading}
      error={records.error}
      onRetry={records.reload}
      upload={daily.state}
      onPick={daily.pick}
      onAnalyze={daily.analyze}
      onCancel={daily.cancel}
      onRetrySave={daily.retrySave}
      onReset={daily.reset}
      weekly={weekly.state}
      onGenerateWeekly={() => records.data && weekly.generate(thisWeekDaily(records.data.daily, Date.now()))}
      onRetryWeeklySave={weekly.retrySave}
      onOpenResult={openResult}
      onOpenHistory={() => router.push("/history")}
      onOpenProfile={() => router.push("/more")}
    />
  );
}
