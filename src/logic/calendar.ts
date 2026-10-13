/**
 * 날짜 키("2026-10-13") 달력 계산 (M7) — 순수 함수만 둔다. 런타임 import는 없다.
 *
 * 목표의 시작일 · 종료일은 **날짜만** 쓴다 (서버가 "2026-10-13"을 UTC 자정으로 저장한다 — 웹 `<input type="date">`와 같다).
 * 그래서 이 파일은 시각 · 시간대를 다루지 않고 날짜 키 문자열만 UTC로 계산한다 — 실행 시간대에 따라 답이 달라지지 않는다.
 * "오늘"이 필요하면 호출하는 쪽이 `kstDateKey()`로 키를 만들어 넘긴다.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DOW = ["일", "월", "화", "수", "목", "금", "토"] as const;
export const WEEKDAY_LABELS = DOW;

export interface YearMonth {
  year: number;
  /** 1~12 */
  month: number;
}

const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-13" → 해당 날짜의 UTC 자정(ms). 형식이나 달력에 없는 날짜(2026-02-30 · 13월)면 null */
export function keyToMs(key: string): number | null {
  const m = KEY.exec(key);
  if (!m) return null;
  const ms = Date.parse(`${key}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  // Date.parse가 02-30을 03-02로 넘겨 받아들이는 환경이 있다 — 되돌려 같은지 본다
  return new Date(ms).toISOString().slice(0, 10) === key ? ms : null;
}

export const isDateKey = (key: string): boolean => keyToMs(key) !== null;

/** 날짜 키에 일 수를 더한다 — 잘못된 키면 그대로 돌려준다 */
export function addDays(key: string, days: number): string {
  const ms = keyToMs(key);
  return ms === null ? key : new Date(ms + days * DAY_MS).toISOString().slice(0, 10);
}

/** b − a (일) — 같은 날이면 0. 어느 쪽이든 잘못된 키면 null */
export function daysBetween(a: string, b: string): number | null {
  const x = keyToMs(a);
  const y = keyToMs(b);
  return x === null || y === null ? null : Math.round((y - x) / DAY_MS);
}

/** 0=일 ~ 6=토 */
export function dayOfWeek(key: string): number | null {
  const ms = keyToMs(key);
  return ms === null ? null : new Date(ms).getUTCDay();
}

/** "2026-10-13" → "2026.10.13 (화)" */
export function dateLabel(key: string): string {
  const dow = dayOfWeek(key);
  if (dow === null) return key;
  return `${key.replace(/-/g, ".")} (${DOW[dow]})`;
}

export function yearMonthOf(key: string): YearMonth | null {
  const m = KEY.exec(key);
  if (!m || !isDateKey(key)) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

export const monthLabel = ({ year, month }: YearMonth): string => `${year}년 ${month}월`;

const pad = (n: number) => String(n).padStart(2, "0");
export const keyOf = (year: number, month: number, day: number): string => `${year}-${pad(month)}-${pad(day)}`;

/** 그 달의 일 수 */
export function daysInMonth({ year, month }: YearMonth): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * 달력 한 장 — 주(일요일 시작) 단위 행, 칸은 날짜 키 또는 null(앞뒤 빈칸). 항상 7칸씩이고 마지막 주도 7칸으로 채운다.
 */
export function monthGrid(ym: YearMonth): (string | null)[][] {
  const first = new Date(Date.UTC(ym.year, ym.month - 1, 1)).getUTCDay();
  const total = daysInMonth(ym);
  const cells: (string | null)[] = Array.from({ length: first }, () => null);
  for (let d = 1; d <= total; d++) cells.push(keyOf(ym.year, ym.month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}
