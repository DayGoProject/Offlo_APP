/**
 * 홈 = 몰입형 스테이지 (UIUX 실험 A안). 여기서는 불러오기만 하고 그리기는 HomeStage가 한다.
 *
 * 정원 탭과 같은 두 가지를 읽는다 — 동물 상태(Firestore `readGarden`)와 이번 주 분석 기록(오늘 분석 여부 · 주간 미션).
 * 쓰다듬기는 정원 탭과 같은 규칙이다 (`usePetAffection` — 화면에 먼저 반영하고 모아서 서버로).
 * (옛 대시보드 `DashboardView`는 미리보기 `/preview/dashboard`에 남아 있다 — 숫자 화면은 분석 탭으로 옮겨 갈 예정)
 */
import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/auth-context";
import HomeStage from "@/components/home/HomeStage";
import { useAnalysesChanged } from "@/hooks/analyses-changed";
import { useGoalsChanged } from "@/hooks/goals-changed";
import { useNotifications } from "@/hooks/notifications-context";
import { useApiQuery } from "@/hooks/use-api-query";
import { usePetAffection } from "@/hooks/use-pet-affection";
import { WEEKLY_THRESHOLD, type AnalysisRecords } from "@/logic/analysis";
import { api } from "@/services/api";
import { readGarden } from "@/services/garden";

export default function HomeTab() {
  const router = useRouter();
  const { user } = useAuth();
  const { unread } = useNotifications();
  // `/?still=1` — 동물을 정지 포즈로 둔다 (정원 탭과 같은 이유: 움직이는 화면에서는 uiautomator 덤프가 실패한다)
  const { still } = useLocalSearchParams<{ still?: string }>();
  // 탭 화면은 한 번 열리면 살아 있다 — 다른 탭에 가 있는 동안엔 3D 프레임 루프를 멈춘다
  const focused = useIsFocused();
  const [now, setNow] = useState(() => Date.now());

  const garden = useApiQuery(async () => {
    if (!user) throw new Error("로그인이 필요합니다.");
    return readGarden(user.uid);
  });
  useAnalysesChanged(garden.reload);
  useGoalsChanged(garden.reload);

  // 오늘 분석했는지 · 이번 주 분석 개수 — 실패해도 홈은 열린다 (오늘 줄이 동물 상태 문구로 대신한다)
  const records = useApiQuery<AnalysisRecords>(async (signal) => {
    const [daily, weekly] = await Promise.all([
      api.analyses.list({ periodType: "daily", limit: WEEKLY_THRESHOLD }, signal),
      api.analyses.list({ periodType: "weekly", limit: 1 }, signal),
    ]);
    return { daily: daily.analyses, weekly: weekly.analyses };
  });
  useAnalysesChanged(records.reload);

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

  const affection = usePetAffection({
    pet: garden.data?.animal?.pet,
    scope: garden.data?.animal?.type ?? null,
    now,
    send: (count) => api.garden.pet(count),
    active: focused,
    onFailed: reloadGarden,
  });

  return (
    <HomeStage
      now={now}
      data={garden.data}
      loading={garden.loading}
      error={garden.error}
      onRetry={reload}
      records={records.data}
      weekStatus={records.data ? "ready" : records.error ? "error" : "loading"}
      animate={still !== "1"}
      active={focused}
      affection={garden.data?.animal?.type ? affection : null}
      unreadCount={unread}
      onOpenNotifications={() => router.push("/notifications")}
      onOpenProfile={() => router.push("/more")}
      onUpload={() => router.navigate({ pathname: "/analysis", params: { start: "pick" } })}
      onOpenToday={(id) => router.push({ pathname: "/result/[id]", params: { id } })}
      onOpenGarden={() => router.navigate("/garden")}
    />
  );
}
