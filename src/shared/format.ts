/**
 * @offlo-shared — 자동 생성 파일. 직접 수정하지 마세요.
 * 원본: Offlo/web/src/lib/format.ts
 * 갱신: node scripts/sync-shared.mjs --pull
 */
/**
 * 표시용 포맷 유틸 — 클라이언트·서버 양쪽 안전 (외부 의존성 없음).
 *
 * 13단계 이전에는 fmt가 4개 페이지에, fmtDate가 3개 페이지에 각각 복사돼 있었다.
 * 표기가 갈라지는 것을 막기 위해 여기로 모은다.
 */

/** 분 → "3시간 20분" / "3시간" / "20분" */
export function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

/** ISO → "2026.09.04" */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/** ISO → "9.04" (연도를 뺀 짧은 표기) */
export function fmtDateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}`;
}

/** ISO → "오늘" / "어제" / "9/4" */
export function relDate(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return "오늘";
  if (diff === 1) return "어제";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** ISO → "방금" / "12분 전" / "3시간 전" / "2일 전" / "9.04" */
export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return fmtDateShort(iso);
}
