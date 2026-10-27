/**
 * 예약 알림 동기화 — 설정 · 권한 · 분석 · 목표 · 정원이 바뀌었을 때 **계획을 다시 세워 기기의 예약을 갈아 끼운다.**
 *
 * 로컬 알림은 예약 시점에 내용이 정해지므로(그때 확인해서 울리지 못한다) "지금 상태"로 앞날을 다시 계산해 두는 일이 핵심이다:
 *  · 설정이 바뀔 때 · 앱이 앞으로 돌아올 때(`active`) · 분석을 저장할 때(그날 저녁 리마인더가 빠진다) · 목표가 바뀔 때
 *  · 읽기에 실패한 자료는 "모른다"로 두고 그 종류의 기존 예약은 건드리지 않는다 (`planReminders`의 `complete`).
 *  · 설정이 모두 꺼졌거나 권한이 없으면 우리 예약을 전부 지운다 (서버 요청도 하지 않는다).
 *
 * 한 번에 하나만 돈다 — 도는 중에 또 요청이 오면 끝난 뒤 한 번 더 돈다 (그 사이 바뀐 값을 놓치지 않는다).
 * 앞으로 돌아올 때의 반영은 1분에 한 번으로 제한한다 (서버 요청 셋을 매번 보내지 않는다).
 */
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useAnalysesChanged } from "@/hooks/analyses-changed";
import { useGoalsChanged } from "@/hooks/goals-changed";
import type { ReminderSettings } from "@/hooks/use-reminder-settings";
import { anyOn, planInputFrom, planReminders, sourcesNeeded, type PlanSources, type ReminderService } from "@/logic/reminders";

const FOREGROUND_THROTTLE_MS = 60_000;

export function useReminderSync({
  service,
  settings,
  loadSources,
  now = Date.now,
}: {
  service: ReminderService | null;
  settings: ReminderSettings;
  /** 켜진 종류에 필요한 자료만 읽는다 — 못 읽은 것은 null */
  loadSources: (needed: ReturnType<typeof sourcesNeeded>) => Promise<PlanSources>;
  /** 시계 — 미리보기가 고정된 시각을 쓴다 (기본은 지금) */
  now?: () => number;
}): void {
  // 늘 최신 값을 읽도록 ref에 둔다 — 도는 중에 값이 바뀌어도(다시 한 번 도는 동안) 옛 값으로 계획하지 않는다.
  // (이 효과를 아래 효과들보다 먼저 선언한다 — 같은 커밋에서 먼저 돌아야 `run`이 새 값을 본다)
  const latest = useRef({ service, settings, loadSources, now });
  useEffect(() => {
    latest.current = { service, settings, loadSources, now };
  });
  const running = useRef(false);
  const again = useRef(false);
  const lastRun = useRef(0);

  const run = useCallback(async (force: boolean) => {
    const svc = latest.current.service;
    if (!svc?.supported) return;
    if (!force && Date.now() - lastRun.current < FOREGROUND_THROTTLE_MS) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    try {
      do {
        again.current = false;
        const { settings: current, loadSources: load, now: clock } = latest.current;
        const { ready, prefs, permission } = current;
        if (!ready) break; // 저장된 설정을 읽기 전에 지우지 않는다
        if (!anyOn(prefs) || permission.state !== "granted") {
          await svc.cancelAll();
        } else {
          const at = clock();
          const sources = await load(sourcesNeeded(prefs));
          await svc.sync(planReminders({ now: at, prefs, ...planInputFrom(sources, at) }), prefs);
        }
        lastRun.current = Date.now();
      } while (again.current);
    } catch {
      // 반영 실패는 다음 기회(앱을 다시 열 때 · 설정을 바꿀 때)에 다시 맞춰진다
    } finally {
      running.current = false;
    }
  }, []);

  // 설정 · 권한이 바뀌었을 때 (처음 읽어 온 순간 포함)
  useEffect(() => {
    void run(true);
  }, [run, settings.ready, settings.prefs, settings.permission.state]);

  // 분석을 저장했다 · 목표가 바뀌었다
  useAnalysesChanged(() => void run(true));
  useGoalsChanged(() => void run(true));

  // 앱이 앞으로 돌아왔다 — 기기 설정에서 권한을 바꿨을 수 있고, 날이 바뀌었을 수 있다
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void latest.current.settings.refreshPermission();
      void run(false);
    });
    return () => subscription.remove();
  }, [run]);
}
