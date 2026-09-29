/**
 * AI 분석 탭의 두 흐름 — 화면(app/(app)/(tabs)/analysis.tsx)은 이 훅을 부르고 상태를 AnalysisView에 넘기기만 한다.
 *
 * 일간: 사진 고르기 → 압축 → AI 분석(`/api/ai/analyze`) → 저장(`/api/analyses`) → 결과 화면
 * 주간: 이번 주 일간 7개 → AI 주간 분석(`/api/ai/weekly`) → 저장 → 결과 화면
 *
 * 규칙
 * - **AI 호출은 자동으로 다시 보내지 않는다** (비용 · 일간 1회 — api-client가 재시도하지 않는다). 다시 시도는 사용자가 누른다
 * - **저장만 실패하면 AI 결과를 들고 저장만 다시 시도한다** — AI를 다시 부르지 않는다
 * - 409(이미 분석함)는 AI 단계 · 저장 단계 어디서 와도 같다 — 서버가 AI 호출 전에도 확인한다
 *   (일간 하루 1회 · 주간 한 주 1회 — 웹 `lib/analysis-limits.ts`).
 *   409는 "방금 저장했는데 응답만 잃었다"일 수도 있으니 그 기록을 찾아 결과 화면으로 보낸다
 */
import { useRef, useState } from "react";

import {
  thisWeekWeekly,
  todayDaily,
  weeklySummaries,
  type UploadState,
  type WeeklyState,
} from "@/logic/analysis";
import { ApiError, api, getErrorMessage } from "@/services/api";
import type { AnalysisResult, AnalysisSummary } from "@/services/api-types";
import { ImageError, getImageErrorMessage, pickImage, toInlineImage } from "@/services/image";

const isConflict = (e: unknown): e is ApiError => e instanceof ApiError && e.status === 409;

/* ── 일간 ───────────────────────────────────────────────────── */

const IDLE: UploadState = { phase: "idle", imageUri: null, error: null };

export function useDailyAnalysis({
  onSaved,
  onAlreadyDone,
}: {
  /** 저장된(또는 이미 있던) 오늘 분석으로 이동 */
  onSaved: (analysisId: string) => void;
  /** 오늘 분석이 이미 있다 — 탭의 기록을 다시 불러와 "오늘 완료"로 바꾼다 */
  onAlreadyDone: () => void;
}) {
  const [state, setState] = useState<UploadState>(IDLE);
  /** AI 결과 — 저장만 다시 시도할 때 쓴다 */
  const result = useRef<AnalysisResult | null>(null);
  const controller = useRef<AbortController | null>(null);

  async function pick() {
    try {
      const uri = await pickImage();
      if (uri) setState({ phase: "picked", imageUri: uri, error: null });
    } catch (e) {
      setState((s) => ({ ...s, error: getImageErrorMessage(e) }));
    }
  }

  async function analyze() {
    const uri = state.imageUri;
    if (!uri) return;
    const abort = new AbortController();
    controller.current = abort;
    setState((s) => ({ ...s, phase: "preparing", error: null }));

    try {
      const image = await toInlineImage(uri);
      if (abort.signal.aborted) return;
      setState((s) => ({ ...s, phase: "analyzing" }));
      result.current = (await api.ai.analyze(image, abort.signal)).analysisData;
    } catch (e) {
      if (abort.signal.aborted) return; // 취소는 cancel()이 이미 되돌렸다
      if (isConflict(e)) {
        onAlreadyDone();
        setState({ ...IDLE, error: e.message });
        return;
      }
      setState((s) => ({
        ...s,
        phase: "picked",
        error: e instanceof ImageError ? e.message : getErrorMessage(e),
      }));
      return;
    } finally {
      if (controller.current === abort) controller.current = null;
    }
    await save();
  }

  async function save() {
    const data = result.current;
    if (!data) return;
    setState((s) => ({ ...s, phase: "saving", error: null }));
    try {
      const { analysisId } = await api.analyses.create(data);
      finish(analysisId);
    } catch (e) {
      if (isConflict(e)) {
        // 오늘 기록이 이미 있다 — 방금 저장이 응답만 잃었거나 다른 기기에서 먼저 분석했다. 오늘 결과는 그것 하나다
        const today = await findToday();
        if (today) {
          finish(today);
          return;
        }
        onAlreadyDone();
        result.current = null;
        setState({ ...IDLE, error: e.message });
        return;
      }
      setState((s) => ({ ...s, phase: "save-failed", error: getErrorMessage(e) }));
    }
  }

  function finish(analysisId: string) {
    result.current = null;
    setState(IDLE);
    onSaved(analysisId);
  }

  function cancel() {
    controller.current?.abort();
    controller.current = null;
    setState((s) => ({ ...s, phase: "picked", error: null }));
  }

  /** 고른 사진 · AI 결과를 버리고 처음으로 */
  function reset() {
    result.current = null;
    setState(IDLE);
  }

  return { state, pick, analyze, retrySave: save, cancel, reset };
}

async function findToday(): Promise<string | null> {
  try {
    const { analyses } = await api.analyses.list({ periodType: "daily", limit: 1 });
    return todayDaily(analyses, Date.now())?.id ?? null;
  } catch {
    return null;
  }
}

async function findThisWeekWeekly(): Promise<string | null> {
  try {
    const { analyses } = await api.analyses.list({ periodType: "weekly", limit: 1 });
    return thisWeekWeekly(analyses, Date.now())?.id ?? null;
  } catch {
    return null;
  }
}

/* ── 주간 ───────────────────────────────────────────────────── */

export function useWeeklyAnalysis({ onSaved }: { onSaved: (analysisId: string) => void }) {
  const [state, setState] = useState<WeeklyState>({ phase: "idle", error: null });
  const pending = useRef<{ data: AnalysisResult; sourceAnalysisIds: string[] } | null>(null);

  /** records: 이번 주 일간 분석 7개, 오래된 → 최신 (logic/analysis.ts `thisWeekDaily`) */
  async function generate(records: AnalysisSummary[]) {
    setState({ phase: "generating", error: null });
    try {
      const { analysisData } = await api.ai.weekly({ dailySummaries: weeklySummaries(records) });
      pending.current = { data: analysisData, sourceAnalysisIds: records.map((r) => r.id) };
    } catch (e) {
      // 이번 주 주간 분석을 이미 받았다 (다른 기기에서) — 그 결과로 보낸다
      if (isConflict(e)) {
        const existing = await findThisWeekWeekly();
        if (existing) {
          finish(existing);
          return;
        }
      }
      setState({ phase: "idle", error: getErrorMessage(e) });
      return;
    }
    await save(false);
  }

  async function save(retrying: boolean) {
    const p = pending.current;
    if (!p) return;
    setState({ phase: "saving", error: null });
    try {
      if (retrying) {
        // 앞선 저장이 응답만 잃었을 수 있다 — 다시 보내기 전에 이번 주 주간 분석이 이미 생겼는지 본다
        const existing = await findThisWeekWeekly();
        if (existing) {
          finish(existing);
          return;
        }
      }
      const { analysisId } = await api.analyses.create({ ...p.data, sourceAnalysisIds: p.sourceAnalysisIds });
      finish(analysisId);
    } catch (e) {
      if (isConflict(e)) {
        const existing = await findThisWeekWeekly();
        if (existing) {
          finish(existing);
          return;
        }
      }
      setState({ phase: "save-failed", error: getErrorMessage(e) });
    }
  }

  function finish(analysisId: string) {
    pending.current = null;
    setState({ phase: "idle", error: null });
    onSaved(analysisId);
  }

  return { state, generate, retrySave: () => save(true) };
}
