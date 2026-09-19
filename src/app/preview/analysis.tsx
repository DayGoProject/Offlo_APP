/**
 * AI 분석 탭 미리보기 — `?state=`
 *   ready · picked · analyzing · save-failed · done · weekly · empty · loading · error
 * 샘플 값만 쓴다 (api · useAuth 금지). 분석 방법 모달은 실제로 열린다.
 */
import { useLocalSearchParams } from "expo-router";

import AnalysisView from "@/components/analysis/AnalysisView";
import type { AnalysisRecords, UploadPhase, UploadState } from "@/logic/analysis";
import {
  ANALYSIS_DONE,
  ANALYSIS_EMPTY,
  ANALYSIS_READY,
  ANALYSIS_WEEKLY,
  SAMPLE_NOW,
  SAMPLE_SCREENSHOT,
  WEEKLY_NOW,
} from "@/preview/samples";
import { API_MESSAGES } from "@/services/api-client";

const noop = () => {};

const RECORDS: Record<string, AnalysisRecords> = {
  ready: ANALYSIS_READY,
  picked: ANALYSIS_READY,
  analyzing: ANALYSIS_READY,
  "save-failed": ANALYSIS_READY,
  done: ANALYSIS_DONE,
  weekly: ANALYSIS_WEEKLY,
  empty: ANALYSIS_EMPTY,
};

const PHASES: Record<string, UploadPhase> = {
  picked: "picked",
  analyzing: "analyzing",
  "save-failed": "save-failed",
};

export default function AnalysisPreview() {
  const { state = "ready" } = useLocalSearchParams<{ state?: string }>();
  const phase = PHASES[state] ?? "idle";
  const upload: UploadState = {
    phase,
    imageUri: phase === "idle" ? null : SAMPLE_SCREENSHOT,
    error: phase === "save-failed" ? API_MESSAGES.network : null,
  };

  return (
    <AnalysisView
      now={(state === "weekly" ? WEEKLY_NOW : SAMPLE_NOW).getTime()}
      records={RECORDS[state] ?? null}
      loading={state === "loading"}
      error={state === "error" ? API_MESSAGES.network : null}
      onRetry={noop}
      upload={upload}
      onPick={noop}
      onAnalyze={noop}
      onCancel={noop}
      onRetrySave={noop}
      onReset={noop}
      weekly={{ phase: "idle", error: null }}
      onGenerateWeekly={noop}
      onRetryWeeklySave={noop}
      onOpenResult={noop}
    />
  );
}
