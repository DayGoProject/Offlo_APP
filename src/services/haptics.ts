/**
 * 햅틱 — 정원 동물과의 상호작용에 손맛을 더한다 (docs/garden-game-design.md 5장 "손맛 표").
 * 화면은 `haptic("tap")`처럼 **무슨 일이 있었는지**만 말하고, 어떤 진동 패턴인지는 여기서 정한다.
 *
 *  tap      동물 탭 · 약한 충격
 *  tick     문지르는 동안 구간마다 · 짧은 틱
 *  soft     굶주린 동물 탭 · 상한을 채운 뒤의 탭 — 아주 부드럽게
 *  success  밥 먹기 · 오늘 상한 달성 · 친밀도 레벨 상승
 *  recover  굶주림에서 회복 — 묵직한 충격 뒤에 성공
 *  grow     부화 · 성장 단계 상승 — 묵직한 충격 두 번
 *
 * 규칙
 *  · 모든 호출은 에러를 삼킨다 — 진동은 장식이다 (진동기가 없는 기기 · 시스템에서 꺼 둔 경우도 조용히 넘어간다).
 *  · `expo-haptics`는 **쓰는 순간 불러온다** — 네이티브 모듈이라 이 모듈을 넣기 전에 만든 개발 빌드에서는 import하는 순간 앱이 죽는다 (mobile.md).
 *  · 시스템 설정(iOS 시스템 햅틱 · 안드로이드 터치 진동)을 따른다. 앱 안에 끄기 스위치는 두지 않았다.
 *  · 개발 모드에서는 호출 기록을 `globalThis.__offloHaptics`에 남긴다 — 웹 검증이 "어떤 햅틱이 요청됐나"를 본다 (진동은 웹 브라우저에서 보이지 않는다).
 */
export type HapticKind = "tap" | "tick" | "soft" | "success" | "recover" | "grow";

type HapticsModule = typeof import("expo-haptics");

let loaded: HapticsModule | null | undefined;

function load(): HapticsModule | null {
  if (loaded !== undefined) return loaded;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 쓰는 순간 불러온다 (위 설명)
    loaded = require("expo-haptics") as HapticsModule;
  } catch {
    loaded = null;
  }
  return loaded;
}

function record(kind: HapticKind): void {
  if (!__DEV__) return;
  const g = globalThis as { __offloHaptics?: HapticKind[] };
  const log = (g.__offloHaptics ??= []);
  log.push(kind);
  if (log.length > 200) log.shift();
}

function safe(run: () => Promise<void>): void {
  try {
    run().catch(() => {});
  } catch {
    // 진동기가 없다 · 모듈이 없다 — 넘어간다
  }
}

export function haptic(kind: HapticKind): void {
  record(kind);
  const H = load();
  if (!H) return;
  switch (kind) {
    case "tap":
      safe(() => H.impactAsync(H.ImpactFeedbackStyle.Light));
      break;
    case "tick":
      safe(() => H.selectionAsync());
      break;
    case "soft":
      safe(() => H.impactAsync(H.ImpactFeedbackStyle.Soft));
      break;
    case "success":
      safe(() => H.notificationAsync(H.NotificationFeedbackType.Success));
      break;
    case "recover":
      safe(() => H.impactAsync(H.ImpactFeedbackStyle.Heavy));
      setTimeout(() => safe(() => H.notificationAsync(H.NotificationFeedbackType.Success)), 150);
      break;
    case "grow":
      safe(() => H.impactAsync(H.ImpactFeedbackStyle.Heavy));
      setTimeout(() => safe(() => H.impactAsync(H.ImpactFeedbackStyle.Heavy)), 170);
      break;
  }
}
