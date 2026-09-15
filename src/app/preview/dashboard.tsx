/**
 * 대시보드 미리보기 — `?state=ready|empty|loading|error`. 샘플 값만 쓴다 (api · useAuth 금지).
 */
import { useLocalSearchParams } from "expo-router";

import DashboardView from "@/components/dashboard/DashboardView";
import { DASHBOARD_EMPTY, DASHBOARD_READY, SAMPLE_NAME, SAMPLE_NOW } from "@/preview/samples";
import { API_MESSAGES } from "@/services/api-client";

const noop = () => {};

export default function DashboardPreview() {
  const { state = "ready" } = useLocalSearchParams<{ state?: string }>();

  return (
    <DashboardView
      name={SAMPLE_NAME}
      now={SAMPLE_NOW}
      data={state === "ready" ? DASHBOARD_READY : state === "empty" ? DASHBOARD_EMPTY : null}
      loading={state === "loading"}
      error={state === "error" ? API_MESSAGES.network : null}
      onRetry={noop}
      onOpenHistory={noop}
      onOpenAnalysis={noop}
      onOpenGoals={noop}
      onOpenGarden={noop}
    />
  );
}
