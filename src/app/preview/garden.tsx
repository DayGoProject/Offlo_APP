/**
 * 정원 미리보기 — `?state=fed|peckish|starving|egg|none|legend|loading|error` (`&still=1`이면 동물 정지 포즈 · `&minutes=N`이면 식물 경험치 덮어쓰기 ·
 * `&then=fed`이면 4.5초 뒤 같은 동물이 밥을 먹은 상태로 바뀌며 먹는 연출이 돈다). 샘플 값만 쓴다 (api · useAuth 금지).
 * 동물 선택 · 변경은 화면 안에서 눌러 본다 — 저장은 하지 않고 성공한 것으로 돌려준다.
 */
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import GardenView from "@/components/garden/GardenView";
import { GARDEN_NOW, GARDEN_SAMPLES } from "@/preview/samples";
import { API_MESSAGES } from "@/services/api-client";

const noop = () => {};
/** `&then=fed` — 이 시간 뒤 같은 동물이 분석을 마친 것처럼 배부름으로 바뀐다 (먹는 연출 확인용) */
const THEN_AFTER_MS = 4500;

export default function GardenPreview() {
  const { state = "fed", still, minutes, then } = useLocalSearchParams<{ state?: string; still?: string; minutes?: string; then?: string }>();
  const [fedNow, setFedNow] = useState(false);
  useEffect(() => {
    if (then !== "fed") return;
    const id = setTimeout(() => setFedNow(true), THEN_AFTER_MS);
    return () => clearTimeout(id);
  }, [then]);

  const sample = GARDEN_SAMPLES[state === "save-error" ? "fed" : state] ?? null;
  // `&minutes=5000` — 식물 단계를 바꿔 보며 화분 위치 · 그림을 확인한다
  const base = sample && minutes && Number.isFinite(Number(minutes)) ? { ...sample, totalDetoxMinutes: Number(minutes) } : sample;
  // 오늘 분석을 마쳤다 — 같은 동물의 마지막 분석일이 오늘이 되고 연속 기록이 하루 늘어난다 (서버가 하는 일을 흉내 낸다)
  const data =
    fedNow && base?.animal && base.animal.lastAnalysisDate !== GARDEN_SAMPLES.fed.animal?.lastAnalysisDate
      ? { ...base, animal: { ...base.animal, streak: base.animal.streak + 1, lastAnalysisDate: GARDEN_SAMPLES.fed.animal?.lastAnalysisDate ?? null } }
      : base;

  return (
    <GardenView
      now={GARDEN_NOW}
      data={data}
      loading={state === "loading"}
      error={state === "error" ? API_MESSAGES.network : null}
      saving={false}
      actionError={state === "save-error" ? API_MESSAGES.network : null}
      onRetry={noop}
      onSelectAnimal={async () => true}
      onFeed={noop}
      animate={still !== "1"}
    />
  );
}
