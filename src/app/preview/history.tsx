/**
 * 분석 기록 미리보기 — `?state=ready|empty|loading|error`. 샘플 값만 쓴다 (api · useAuth 금지).
 * 필터(전체 · 일간 · 주간)는 실제로 동작한다.
 */
import { useState } from "react";
import { useLocalSearchParams } from "expo-router";

import HistoryView from "@/components/history/HistoryView";
import type { HistoryFilter } from "@/logic/history";
import { HISTORY_READY } from "@/preview/samples";
import { API_MESSAGES } from "@/services/api-client";

const noop = () => {};

export default function HistoryPreview() {
  const { state = "ready" } = useLocalSearchParams<{ state?: string }>();
  const [filter, setFilter] = useState<HistoryFilter>("all");

  return (
    <HistoryView
      analyses={state === "ready" ? HISTORY_READY : state === "empty" ? [] : null}
      loading={state === "loading"}
      error={state === "error" ? API_MESSAGES.network : null}
      onRetry={noop}
      filter={filter}
      onFilterChange={setFilter}
      onOpenAnalysis={noop}
    />
  );
}
