/**
 * 정원 탭 — 불러오기와 저장만 여기서, 그리기는 GardenView가 한다.
 *
 * 읽기는 Firestore(`readGarden`), 쓰기는 웹 API(`api.garden.selectAnimal` · `api.garden.pet`)뿐이다 — 경험치 · 연속 기록은 서버가 올리고
 * 앱은 `plant-exp`를 부르지 않는다 (docs/garden-game-design.md 기둥 5).
 * 쓰다듬기는 화면에 먼저 반영하고 모아서 `api.garden.pet`으로 보낸다 (`hooks/use-pet-affection`).
 * 오늘의 미션의 "이번 주 주간 분석"은 분석 탭과 같은 두 목록(최근 일간 7건 · 최근 주간 1건)으로 센다 — 못 불러와도 정원은 그대로 열린다.
 */
import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/auth-context";
import GardenView from "@/components/garden/GardenView";
import { useAnalysesChanged } from "@/hooks/analyses-changed";
import { useApiQuery } from "@/hooks/use-api-query";
import { usePetAffection } from "@/hooks/use-pet-affection";
import { WEEKLY_THRESHOLD, type AnalysisRecords } from "@/logic/analysis";
import { api } from "@/services/api";
import { getErrorMessage } from "@/services/api-client";
import { readGarden } from "@/services/garden";
import type { AnimalTypeId } from "@/shared/garden-utils";

export default function GardenTab() {
  const router = useRouter();
  // `/garden?still=1` — 동물을 정지 포즈로 둔다. 계속 움직이는 화면에서는 `uiautomator dump`가 "idle 상태를 못 얻는다"며 실패해
  // 안드로이드 검증(글자 · 좌표 읽기)이 막히기 때문이다. 시스템 "동작 줄이기"와 같은 효과이고 인증 · 데이터와 무관하다
  const { still } = useLocalSearchParams<{ still?: string }>();
  const { user } = useAuth();
  // 탭 화면은 한 번 열리면 살아 있다 — 다른 탭에 가 있는 동안엔 3D 프레임 루프를 멈춘다
  const focused = useIsFocused();
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const garden = useApiQuery(async () => {
    if (!user) throw new Error("로그인이 필요합니다.");
    return readGarden(user.uid);
  });
  // 분석을 저장하면 밥을 먹은 것이다 — 연속 기록 · 식물 경험치 · 동물 상태가 바뀐다
  useAnalysesChanged(garden.reload);

  // 이번 주 분석 기록 — 주간 분석 미션 전용. 실패해도 정원 화면을 막지 않는다 (미션 줄만 "불러오지 못했어요")
  const records = useApiQuery<AnalysisRecords>(async (signal) => {
    const [daily, weekly] = await Promise.all([
      api.analyses.list({ periodType: "daily", limit: WEEKLY_THRESHOLD }, signal),
      api.analyses.list({ periodType: "weekly", limit: 1 }, signal),
    ]);
    return { daily: daily.analyses, weekly: weekly.analyses };
  });
  useAnalysesChanged(records.reload);

  // 탭에 돌아올 때마다 다시 본다 — 웹에서 분석했거나 자정이 지났을 수 있다. 첫 포커스는 위 불러오기가 한다
  const reloadGarden = garden.reload;
  const reloadRecords = records.reload;
  const reload = useCallback(() => {
    reloadGarden();
    reloadRecords();
  }, [reloadGarden, reloadRecords]);
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

  // 쓰다듬기 → 친밀도. 전송에 실패하면 서버 값을 다시 읽어 맞춘다
  const affection = usePetAffection({
    pet: garden.data?.animal?.pet,
    scope: garden.data?.animal?.type ?? null,
    now,
    send: (count) => api.garden.pet(count),
    active: focused,
    onFailed: reloadGarden,
  });

  const selectAnimal = async (type: AnimalTypeId, reset: boolean): Promise<boolean> => {
    setSaving(true);
    setActionError(null);
    try {
      await api.garden.selectAnimal(type, reset);
      // 서버가 진실이다 — 쓴 값을 화면에 끼워 넣지 않고 다시 읽는다
      reload();
      return true;
    } catch (e) {
      setActionError(getErrorMessage(e));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <GardenView
      now={now}
      data={garden.data}
      loading={garden.loading}
      error={garden.error}
      saving={saving}
      actionError={actionError}
      onRetry={reload}
      onSelectAnimal={selectAnimal}
      onFeed={() => router.navigate("/analysis")}
      animate={still !== "1"}
      active={focused}
      affection={garden.data?.animal?.type ? affection : null}
      weekRecords={records.data}
      weekStatus={records.data ? "ready" : records.error ? "error" : "loading"}
    />
  );
}
