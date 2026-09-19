/**
 * 분석용 이미지 압축 규칙 — 웹 `services/image.ts`(canvas)와 같은 값. 실제 인코딩은 `services/image.ts`
 * (expo-image-manipulator)가 하고, 여기는 크기 · 품질 계산만 둔다 (Node로 검증 — scripts/verify-M5-logic.mjs).
 *
 * 이미지는 저장하지 않고 요청 본문에 실어 보낸다 → Vercel 본문 상한(4.5MB) 아래로 낮춰야 한다.
 * 서버(`lib/ai.ts`)는 base64 4MB까지 받고, 클라이언트는 여유를 두고 3MB에서 멈춘다.
 */

/** 장변 기준 — 스크린타임 판독에 충분한 해상도 */
export const MAX_DIMENSION = 1600;
export const INITIAL_QUALITY = 0.85;
export const MIN_QUALITY = 0.4;
export const QUALITY_STEP = 0.15;
/** base64 문자열 길이 상한 */
export const MAX_BASE64_LENGTH = 3 * 1024 * 1024;

export const IMAGE_MESSAGES = {
  unreadable: "이 이미지를 읽을 수 없습니다. 다른 스크린샷을 골라주세요.",
  tooLarge: "이미지 용량이 너무 큽니다. 더 작은 이미지를 사용해주세요.",
  pickerFailed: "사진을 열 수 없습니다. 설정에서 사진 접근을 허용한 뒤 다시 시도해주세요.",
} as const;

/** 장변이 max를 넘으면 비율을 지켜 줄인 크기, 넘지 않으면 null (그대로 쓴다) */
export function fitWithin(
  width: number,
  height: number,
  max: number = MAX_DIMENSION,
): { width: number; height: number } | null {
  const long = Math.max(width, height);
  if (!(long > max)) return null;
  const scale = max / long;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** 시도할 JPEG 품질 순서 — 웹 루프(0.85에서 0.15씩, 0.4에 닿으면 멈춤)와 같다: 0.85 → 0.7 → 0.55 → 0.4 */
export function qualitySteps(): number[] {
  const steps: number[] = [];
  for (let q = INITIAL_QUALITY; q > MIN_QUALITY - 1e-9; q -= QUALITY_STEP) steps.push(Math.round(q * 100) / 100);
  return steps;
}

/** 인코더가 돌려준 base64를 서버가 받는 모양으로 — 줄바꿈 · `data:` 머리를 걷어낸다 (서버는 순수 base64만 받는다) */
export function cleanBase64(value: string): string {
  return value.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
}
