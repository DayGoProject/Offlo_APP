/**
 * @offlo-shared — 자동 생성 파일. 직접 수정하지 마세요.
 * 원본: Offlo/web/src/lib/kst.ts
 * 갱신: node scripts/sync-shared.mjs --pull
 */
/**
 * KST 날짜 유틸 — 클라이언트·서버 양쪽 안전 (외부 의존성 없음).
 *
 * 서버는 "하루"를 KST로 자른다 — 분석 횟수 제한(`lib/analysis-limits.ts`)·연속 기록(`lib/garden.ts`).
 * API의 `createdAt`은 UTC ISO 문자열이라 `slice(0, 10)`으로 날짜를 뽑으면
 * **오전 9시(KST) 전 기록이 전날로 잡힌다.** 화면에서 날짜를 비교할 때는 이 파일을 거친다.
 * KST는 서머타임이 없으므로 24시간을 빼면 정확히 전날이다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** 시각 → KST 날짜 키 "2026-09-15" */
export function kstDateKey(at: string | number | Date = Date.now()): string {
  return new Date(new Date(at).getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 시각이 속한 KST 날짜의 0시 — DB `createdAt`(UTC)과 `gte`로 비교하는 "오늘"의 시작 */
export function kstDayStart(at: string | number | Date = Date.now()): Date {
  return new Date(Date.parse(`${kstDateKey(at)}T00:00:00Z`) - KST_OFFSET_MS);
}

/** 시각이 속한 주의 월요일 0시(KST) — 주간 분석 1회 제한의 "이번 주" 시작 */
export function kstWeekStart(at: string | number | Date = Date.now()): Date {
  const { todayIndex } = kstWeek(new Date(at).getTime());
  return new Date(kstDayStart(at).getTime() - todayIndex * DAY_MS);
}

/** 이번 주(월요일 시작, KST)의 날짜 키 7개와 오늘의 위치. `dow`는 0=일 ~ 6=토 */
export function kstWeek(now: number = Date.now()): {
  days: { key: string; dow: number }[];
  todayIndex: number;
} {
  // 날짜 키를 UTC 자정으로 올려 두고 요일·날짜 산술을 UTC로만 한다 — 브라우저 시간대와 무관해진다
  const todayMs = Date.parse(`${kstDateKey(now)}T00:00:00Z`);
  const todayIndex = (new Date(todayMs).getUTCDay() + 6) % 7;
  const mondayMs = todayMs - todayIndex * DAY_MS;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mondayMs + i * DAY_MS);
    return { key: d.toISOString().slice(0, 10), dow: d.getUTCDay() };
  });
  return { days, todayIndex };
}
