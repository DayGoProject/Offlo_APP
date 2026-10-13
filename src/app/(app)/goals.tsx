/**
 * 목표 관리 — 불러오기와 저장만 여기서, 그리기는 GoalsView가 한다.
 *
 * 쓰기(만들기 · 고치기 · 완료 · 삭제)는 모두 재시도하지 않는다 (`api-client`가 알아서 — 완료는 서버가 식물 경험치를 주고, 만들기는 두 번 가면 두 개가 생긴다).
 * 저장한 뒤에는 쓴 값을 화면에 끼워 넣지 않고 서버에서 다시 읽는다 (서버가 진실이다). 완료가 실패해도 다시 읽는다 —
 * 응답만 잃고 서버에는 이미 완료됐을 수 있어서, 목록이 진실을 말해 주면 같은 버튼을 한 번 더 눌러 보상을 두 번 받는 일이 없다.
 */
import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

import GoalsView from "@/components/goals/GoalsView";
import { notifyGoalsChanged } from "@/hooks/goals-changed";
import { useApiQuery } from "@/hooks/use-api-query";
import { patchFromForm } from "@/logic/goals";
import { api } from "@/services/api";
import { getErrorMessage } from "@/services/api-client";
import type { CreateGoalInput, Goal } from "@/services/api-types";

export default function GoalsScreen() {
  const [now, setNow] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const goals = useApiQuery((signal) => api.goals.list(undefined, signal));

  // 돌아올 때마다 다시 본다 — 자정이 지나 진행률이 바뀌었을 수 있다. 첫 포커스는 위 불러오기가 한다
  const reload = goals.reload;
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

  const saved = () => {
    reload();
    notifyGoalsChanged();
  };

  /** 폼에 띄울 에러 문구를 돌려주는 저장 — 성공하면 null */
  const create = async (input: CreateGoalInput): Promise<string | null> => {
    setActionError(null);
    try {
      await api.goals.create(input);
      saved();
      return null;
    } catch (e) {
      return getErrorMessage(e);
    }
  };

  const update = async (goal: Goal, input: CreateGoalInput): Promise<string | null> => {
    const patch = patchFromForm(goal, input);
    if (!patch) return null; // 바뀐 것이 없다 — 서버에 보내지 않는다 (서버는 빈 수정을 400으로 거절한다)
    setActionError(null);
    try {
      await api.goals.update(goal.id, patch);
      saved();
      return null;
    } catch (e) {
      return getErrorMessage(e);
    }
  };

  const act = async (goal: Goal, run: () => Promise<unknown>) => {
    if (busyId) return;
    setBusyId(goal.id);
    setActionError(null);
    try {
      await run();
    } catch (e) {
      setActionError(getErrorMessage(e));
    } finally {
      setBusyId(null);
      saved();
    }
  };

  return (
    <GoalsView
      now={now}
      goals={goals.data?.goals ?? null}
      loading={goals.loading}
      error={goals.error}
      onRetry={reload}
      busyId={busyId}
      actionError={actionError}
      onCreate={create}
      onUpdate={update}
      onComplete={(goal) => act(goal, () => api.goals.update(goal.id, { status: "completed" }))}
      onDelete={(goal) => act(goal, () => api.goals.remove(goal.id))}
    />
  );
}
