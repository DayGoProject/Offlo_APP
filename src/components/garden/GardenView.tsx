/**
 * 정원 화면의 그림 — 데이터는 props로만 받는다 (mobile.md "웹 미리보기 — 미리보기 화면").
 *
 * `app/(app)/(tabs)/garden.tsx` 는 Firestore · API로 불러와 넘기고, `app/preview/garden.tsx` 는 샘플 값을 넘긴다.
 * 그래서 이 파일은 `api` · `useAuth` · Firebase를 import하지 않는다.
 *
 * 상태 계산 · 동물 선택/변경 · 성장 단계 (6-1) + 방 장면 위에서 사는 동물 (6-2) + 쓰다듬기 · 친밀도 (6-4).
 */
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import Card, { CardHeader } from "@/components/app/Card";
import ErrorNotice from "@/components/app/ErrorNotice";
import PageHeader from "@/components/app/PageHeader";
import Pill from "@/components/app/Pill";
import Screen from "@/components/app/Screen";
import Skeleton from "@/components/app/Skeleton";
import AffectionCard from "@/components/garden/AffectionCard";
import AnimalPicker from "@/components/garden/AnimalPicker";
import ChangeAnimalModal, { type ChangeAnimalTarget } from "@/components/garden/ChangeAnimalModal";
import PetStage from "@/components/garden/PetStage";
import PlantThumb from "@/components/garden/PlantThumb";
import ProgressFoot from "@/components/garden/ProgressFoot";
import type { AffectionControls } from "@/hooks/use-pet-affection";
import {
  animalProgress,
  conditionCopy,
  petCondition,
  plantProgress,
  streakOutlook,
} from "@/logic/garden";
import type { GardenSnapshot } from "@/services/api-types";
import { ANIMAL_STAGES, ANIMAL_TYPES, PLANT_LEVELS, type AnimalTypeId } from "@/shared/garden-utils";
import { colors, fonts } from "@/theme";

export interface GardenViewProps {
  /** 기준 시각(ms) — 동물 상태의 "오늘"(KST) */
  now: number;
  data: GardenSnapshot | null;
  loading: boolean;
  error: string | null;
  /** 동물 선택 · 변경을 서버에 저장하는 중 */
  saving: boolean;
  /** 저장 실패 한 줄 (한국어) */
  actionError: string | null;
  onRetry: () => void;
  /** reset = 변경(연속 기록 초기화), 아니면 첫 선택. 저장에 성공했는지 돌려준다 (실패 문구는 `actionError`로 온다) */
  onSelectAnimal: (type: AnimalTypeId, reset: boolean) => Promise<boolean>;
  /** "밥 주기" = 분석 탭으로 */
  onFeed: () => void;
  /** false면 동물이 정지 포즈 — 스크린샷 비교용 (기본 true) */
  animate?: boolean;
  /** false면 3D 프레임 루프를 멈춘다 (탭이 포커스를 잃었을 때 — 기본 true) */
  active?: boolean;
  /** 쓰다듬기 · 친밀도 — 없으면 쓰다듬어도 화면 효과만 있고 친밀도 카드도 없다 */
  affection?: AffectionControls | null;
}

const grouped = (n: number) => n.toLocaleString("ko-KR");

export default function GardenView({
  now,
  data,
  loading,
  error,
  saving,
  actionError,
  onRetry,
  onSelectAnimal,
  onFeed,
  animate = true,
  active = true,
  affection = null,
}: GardenViewProps) {
  // 변경 중(선택 화면) · 경고 모달 — 화면 안에서만 쓰는 상태
  const [changing, setChanging] = useState(false);
  const [target, setTarget] = useState<ChangeAnimalTarget | null>(null);

  // 처음 불러오다 실패 — 보여줄 것이 없다
  if (!data && error && !loading) {
    return (
      <Screen testID="garden" underTabBar onRefresh={onRetry}>
        <PageHeader eyebrow="반려 정원" title="정원을 불러오지 못했어요" />
        <ErrorNotice testID="garden-error" message={error} onRetry={onRetry} />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen testID="garden" underTabBar>
        <PageHeader eyebrow="반려 정원" title="정원을 불러오는 중이에요" />
        <Skeleton testID="garden-skeleton" height={260} radius={12} />
        <Skeleton height={120} radius={12} />
        <Skeleton height={200} radius={12} />
      </Screen>
    );
  }

  const plant = plantProgress(data.totalDetoxMinutes);
  const animal = data.animal;
  const type = animal?.type ?? null;
  const condition = petCondition(animal, now);

  // 동물을 아직 고르지 않았다 — 선택이 이 화면의 전부다
  if (!animal || !type) {
    const copy = conditionCopy("none", null);
    return (
      <Screen testID="garden" underTabBar refreshing={loading} onRefresh={onRetry}>
        <PageHeader eyebrow={`LV.${plant.level.level} · ${plant.level.name}`} title={copy.headline} />
        <AnimalPicker disabled={saving} onPick={(picked) => onSelectAnimal(picked, false)} />
        {actionError ? <ErrorNotice testID="garden-action-error" message={actionError} /> : null}
        <PlantSection plant={plant} totalMinutes={data.totalDetoxMinutes} />
      </Screen>
    );
  }

  const outlook = streakOutlook(animal, condition);
  const copy = conditionCopy(condition, outlook);
  const progress = animalProgress(animal.streak);
  const typeName = ANIMAL_TYPES.find((t) => t.id === type)?.name ?? "";
  const needsFood = condition !== "fed";

  return (
    <Screen testID="garden" underTabBar refreshing={loading} onRefresh={onRetry}>
      <PageHeader eyebrow={`${typeName} · ${progress.stage.name}`} title={copy.headline} />

      {changing ? (
        <AnimalPicker
          current={type}
          disabled={saving}
          onPick={(to) => setTarget({ from: type, streak: animal.streak, stageName: progress.stage.name, to })}
          onCancel={() => setChanging(false)}
        />
      ) : (
        <>
          <PetStage
            type={type}
            streak={animal.streak}
            condition={condition}
            totalMinutes={data.totalDetoxMinutes}
            now={now}
            animate={animate}
            active={active}
            onPet={affection?.tap}
          />

          <Card testID="pet-condition">
            <Text testID="pet-condition-sub" style={styles.sub}>
              {copy.sub}
            </Text>
            {needsFood ? (
              <View style={styles.row}>
                <Pill
                  testID="garden-feed"
                  variant="accent"
                  label={condition === "egg" ? "첫 분석으로 부화시키기" : "밥 주기 (오늘 분석하기)"}
                  onPress={onFeed}
                />
              </View>
            ) : null}
          </Card>

          {affection ? <AffectionCard view={affection.view} error={affection.error} /> : null}
        </>
      )}

      {actionError ? <ErrorNotice testID="garden-action-error" message={actionError} /> : null}

      <Card testID="animal-growth">
        <CardHeader
          title="반려 동물 성장"
          right={`${progress.stageNumber} / ${ANIMAL_STAGES.length}`}
          rightTone="brand"
        />
        <View style={styles.stages}>
          {ANIMAL_STAGES.map((stage) => {
            const current = stage.status === progress.stage.status;
            const reached = animal.streak >= stage.minStreak;
            return (
              <View
                key={stage.status}
                testID={`stage-row-${stage.status}`}
                accessibilityState={{ selected: current }}
                style={[styles.stageRow, current && styles.stageRowCurrent]}
              >
                <View style={[styles.stageDot, { backgroundColor: reached ? colors.brand : colors.textGhost }]} />
                <Text
                  style={[
                    styles.stageName,
                    { color: current ? colors.brand : reached ? colors.textPrimary : colors.textFaint },
                    current && { fontFamily: fonts.semibold },
                  ]}
                >
                  {stage.name}
                </Text>
                <Text style={styles.stageDays}>{stage.minStreak === 0 ? "시작" : `${stage.minStreak}일`}</Text>
              </View>
            );
          })}
        </View>
        <ProgressFoot
          testID="animal-progress"
          value={progress.next ? `${animal.streak} / ${progress.next.minStreak}` : `${animal.streak}`}
          unit="일"
          ratio={progress.ratio}
          note={progress.next ? `${progress.next.name}까지 ${progress.remainDays}일 남았어요` : "마지막 단계에 도달했어요"}
        />
      </Card>

      <PlantSection plant={plant} totalMinutes={data.totalDetoxMinutes} />

      {!changing ? (
        <View style={styles.row}>
          <Pill testID="animal-change" label="동물 변경하기" onPress={() => setChanging(true)} />
        </View>
      ) : null}

      <ChangeAnimalModal
        target={target}
        saving={saving}
        onCancel={() => setTarget(null)}
        onConfirm={async () => {
          if (!target) return;
          // 저장이 끝날 때까지 모달을 열어 둔다 — 그동안 버튼은 "변경 중…"으로 잠긴다
          const ok = await onSelectAnimal(target.to, true);
          setTarget(null);
          if (ok) setChanging(false);
        }}
      />
    </Screen>
  );
}

function PlantSection({
  plant,
  totalMinutes,
}: {
  plant: ReturnType<typeof plantProgress>;
  totalMinutes: number;
}) {
  return (
    <Card testID="plant-growth">
      <CardHeader title="반려 식물 성장" right={`${plant.level.level} / ${PLANT_LEVELS.length}`} rightTone="brand" />
      <View style={styles.thumbs}>
        {PLANT_LEVELS.map((l) => {
          const current = l.level === plant.level.level;
          const reached = l.level < plant.level.level;
          return (
            <View
              key={l.level}
              testID={`plant-level-${l.level}`}
              accessibilityState={{ selected: current }}
              style={[styles.thumb, current && styles.thumbCurrent]}
            >
              <PlantThumb level={l.level} size={44} opacity={current ? 1 : reached ? 0.45 : 0.22} />
              <Text
                style={[
                  styles.thumbName,
                  { color: current ? colors.brand : reached ? colors.textMuted : colors.textGhost },
                  current && { fontFamily: fonts.semibold },
                ]}
              >
                {l.name}
              </Text>
            </View>
          );
        })}
      </View>
      <ProgressFoot
        testID="plant-progress"
        value={plant.next ? `${grouped(totalMinutes)} / ${grouped(plant.next.minMinutes)}` : grouped(totalMinutes)}
        unit="분"
        ratio={plant.ratio}
        note={plant.next ? `${plant.next.name}까지 ${grouped(plant.remainMinutes)}분 남았어요` : "마지막 단계까지 키웠어요"}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  sub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textPrimarySoft,
  },
  row: {
    flexDirection: "row",
  },
  stages: {
    gap: 6,
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "transparent",
  },
  stageRowCurrent: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentLine,
  },
  stageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stageName: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 16,
  },
  stageDays: {
    fontFamily: fonts.num,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    color: colors.textMuted,
  },
  thumbs: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
  },
  thumb: {
    // 4열 — 7개면 4 + 3
    flexBasis: "25%",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "transparent",
  },
  thumbCurrent: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentLine,
  },
  thumbName: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 12,
    textAlign: "center",
  },
});
