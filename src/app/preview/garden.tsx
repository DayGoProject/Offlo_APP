/**
 * 정원 미리보기 — `?state=fed|peckish|starving|egg|none|legend|loading|error` (`&still=1`이면 동물 정지 포즈 · `&minutes=N`이면 식물 경험치 덮어쓰기 ·
 * `&streak=N`이면 연속 기록 덮어쓰기 · `&then=fed`이면 4.5초 뒤 같은 동물이 밥을 먹은 상태로 바뀌며 먹는 연출이 돈다 — 연속 기록이 하루 늘어 단계 경계를 넘으면 성장 연출).
 * 쓰다듬기: `&today=N`(오늘 이미 쌓은 횟수) · `&total=N`(누적)으로 시작 값을 정하고, `&petfail=1`이면 서버 전송이 실패한다 (친밀도 카드 · 상한 · 레벨업 확인용).
 * 샘플 값만 쓴다 (api · useAuth 금지). 동물 선택 · 변경은 화면 안에서 눌러 본다 — 저장은 하지 않고 성공한 것으로 돌려준다.
 * 쓰다듬기 전송도 가짜다: 서버가 하는 일(`applyPetTaps`)을 같은 함수로 흉내 낸다.
 */
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";

import GardenView from "@/components/garden/GardenView";
import { usePetAffection } from "@/hooks/use-pet-affection";
import { GARDEN_NOW, GARDEN_SAMPLES } from "@/preview/samples";
import { API_MESSAGES, ApiError } from "@/services/api-client";
import { applyPetTaps, type PetRecord } from "@/shared/garden-utils";
import { kstDateKey } from "@/shared/kst";

const noop = () => {};
/** `&then=fed` — 이 시간 뒤 같은 동물이 분석을 마친 것처럼 배부름으로 바뀐다 (먹는 연출 확인용) */
const THEN_AFTER_MS = 4500;

export default function GardenPreview() {
  const { state = "fed", still, minutes, streak, then, today, total, petfail } = useLocalSearchParams<{
    state?: string;
    still?: string;
    minutes?: string;
    streak?: string;
    then?: string;
    today?: string;
    total?: string;
    petfail?: string;
  }>();
  const [fedNow, setFedNow] = useState(false);
  useEffect(() => {
    if (then !== "fed") return;
    const id = setTimeout(() => setFedNow(true), THEN_AFTER_MS);
    return () => clearTimeout(id);
  }, [then]);

  const sample = GARDEN_SAMPLES[state === "save-error" ? "fed" : state] ?? null;
  // `&minutes=5000` — 식물 단계를 바꿔 보며 화분 위치 · 그림을 확인한다
  const withMinutes = sample && minutes && Number.isFinite(Number(minutes)) ? { ...sample, totalDetoxMinutes: Number(minutes) } : sample;
  // `&streak=6&then=fed` — 연속 기록을 정해 두면 밥을 먹는 순간 7일이 되어 "성장 중"으로 자란다 (성장 연출 확인용)
  const base =
    withMinutes?.animal && streak && Number.isFinite(Number(streak))
      ? { ...withMinutes, animal: { ...withMinutes.animal, streak: Math.max(0, Math.floor(Number(streak))) } }
      : withMinutes;
  // 오늘 분석을 마쳤다 — 같은 동물의 마지막 분석일이 오늘이 되고 연속 기록이 하루 늘어난다 (서버가 하는 일을 흉내 낸다)
  const data =
    fedNow && base?.animal && base.animal.lastAnalysisDate !== GARDEN_SAMPLES.fed.animal?.lastAnalysisDate
      ? { ...base, animal: { ...base.animal, streak: base.animal.streak + 1, lastAnalysisDate: GARDEN_SAMPLES.fed.animal?.lastAnalysisDate ?? null } }
      : base;

  // 쓰다듬기 시작 값 — `&today=4&total=9` 처럼 정하면 한 번만 더 쓰다듬어도 상한 · 레벨업을 볼 수 있다
  const dayKey = kstDateKey(GARDEN_NOW);
  const num = (v: string | undefined) => (v !== undefined && Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : null);
  const startPet: PetRecord | null = data?.animal
    ? {
        date: num(today) !== null ? dayKey : data.animal.pet.date,
        today: num(today) ?? data.animal.pet.today,
        total: num(total) ?? data.animal.pet.total,
      }
    : null;
  const serverPet = useRef<PetRecord | null>(startPet);
  const affection = usePetAffection({
    pet: startPet,
    scope: data?.animal?.type ?? null,
    now: GARDEN_NOW,
    getNow: () => GARDEN_NOW,
    send: async (count) => {
      // 검증이 "모아서 한 번에 보냈는가"를 세도록 보낸 횟수를 남긴다 (미리보기 전용)
      const g = globalThis as { __offloPetSends?: number[] };
      (g.__offloPetSends ??= []).push(count);
      await new Promise((r) => setTimeout(r, 250));
      if (petfail === "1") throw new ApiError("network", API_MESSAGES.network);
      const { next } = applyPetTaps(serverPet.current ?? { date: null, today: 0, total: 0 }, dayKey, count);
      serverPet.current = next;
      return next;
    },
    onFailed: () => {
      serverPet.current = startPet;
    },
  });

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
      affection={data?.animal?.type ? affection : null}
    />
  );
}
