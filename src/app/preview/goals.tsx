/**
 * 목표 미리보기 — `?state=ready|empty|loading|error` (`&open=form`이면 추가 폼을 열어 둔다 · `&fail=1`이면 서버 저장이 실패한다).
 * 샘플 값만 쓴다 (api · useAuth 금지). 추가 · 수정 · 완료 · 삭제는 **화면 안의 가짜 서버**로 실제처럼 동작한다 —
 * 폼 검증 · 확인 한 번 더 · 보내는 중 잠금 · 실패 안내를 Playwright가 끝까지 눌러 볼 수 있게.
 */
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";

import GoalsView from "@/components/goals/GoalsView";
import { GOALS_READY, SAMPLE_NOW } from "@/preview/samples";
import { API_MESSAGES } from "@/services/api-client";
import type { CreateGoalInput, Goal } from "@/services/api-types";

const noop = () => {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function GoalsPreview() {
  const { state = "ready", open, fail } = useLocalSearchParams<{ state?: string; open?: string; fail?: string }>();
  const [goals, setGoals] = useState<Goal[]>(state === "ready" ? GOALS_READY : []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const nextId = useRef(1);
  // 검증이 "서버에 몇 번 갔는가"를 세도록 요청을 남긴다 (미리보기 전용)
  const log = (entry: string) => {
    const g = globalThis as { __offloGoalCalls?: string[] };
    (g.__offloGoalCalls ??= []).push(entry);
  };

  const server = async <T,>(entry: string, run: () => T): Promise<T> => {
    log(entry);
    await sleep(250);
    if (fail === "1") throw new Error(API_MESSAGES.network);
    return run();
  };

  const toGoal = (input: CreateGoalInput, id: string, status: Goal["status"] = "active"): Goal => ({
    id,
    userId: "sample",
    title: input.title,
    targetMinutes: input.targetMinutes,
    startDate: `${input.startDate}T00:00:00.000Z`,
    endDate: `${input.endDate}T00:00:00.000Z`,
    status,
    createdAt: new Date(SAMPLE_NOW).toISOString(),
  });

  return (
    <GoalsView
      now={SAMPLE_NOW.getTime()}
      goals={state === "loading" || state === "error" ? null : goals}
      loading={state === "loading"}
      error={state === "error" ? API_MESSAGES.network : null}
      onRetry={noop}
      busyId={busyId}
      actionError={actionError}
      startOpen={open === "form"}
      onCreate={async (input) => {
        try {
          await server(`create ${input.title}`, () => setGoals((g) => [toGoal(input, `new-${nextId.current++}`), ...g]));
          return null;
        } catch (e) {
          return (e as Error).message;
        }
      }}
      onUpdate={async (goal, input) => {
        try {
          await server(`update ${goal.id}`, () => setGoals((g) => g.map((x) => (x.id === goal.id ? toGoal(input, goal.id, x.status) : x))));
          return null;
        } catch (e) {
          return (e as Error).message;
        }
      }}
      onComplete={async (goal) => {
        if (busyId) return;
        setBusyId(goal.id);
        setActionError(null);
        try {
          await server(`complete ${goal.id}`, () => setGoals((g) => g.map((x) => (x.id === goal.id ? { ...x, status: "completed" } : x))));
        } catch (e) {
          setActionError((e as Error).message);
        } finally {
          setBusyId(null);
        }
      }}
      onDelete={async (goal) => {
        if (busyId) return;
        setBusyId(goal.id);
        setActionError(null);
        try {
          await server(`delete ${goal.id}`, () => setGoals((g) => g.filter((x) => x.id !== goal.id)));
        } catch (e) {
          setActionError((e as Error).message);
        } finally {
          setBusyId(null);
        }
      }}
    />
  );
}
