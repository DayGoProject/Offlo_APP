/**
 * 분석 결과 미리보기 — `?state=ready|free|weekly|loading|error`. 샘플 값만 쓴다 (api · useAuth 금지).
 *   ready  프리미엄 일간 (시간대 패턴 있음) · free  시간대 패턴 대신 안내 · weekly  주간 분석
 */
import { useLocalSearchParams } from "expo-router";

import ResultView from "@/components/result/ResultView";
import { RESULT_FREE, RESULT_READY, RESULT_WEEKLY } from "@/preview/samples";
import { API_MESSAGES } from "@/services/api-client";

const noop = () => {};
const SAMPLES = { ready: RESULT_READY, free: RESULT_FREE, weekly: RESULT_WEEKLY } as const;

export default function ResultPreview() {
  const { state = "ready" } = useLocalSearchParams<{ state?: string }>();

  return (
    <ResultView
      analysis={SAMPLES[state as keyof typeof SAMPLES] ?? null}
      loading={state === "loading"}
      error={state === "error" ? API_MESSAGES.network : null}
      onRetry={noop}
      onOpenChat={noop}
      onOpenHistory={noop}
    />
  );
}
