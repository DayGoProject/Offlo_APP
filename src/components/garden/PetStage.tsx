/**
 * 정원 장면 — 방 위에 동물 · 식물 화분 · 밥그릇 · 말풍선이 함께 산다 (docs/garden-game-design.md 4장).
 *
 * 동물은 **3D 클레이 모델**이다 (`three/PetCanvas` — 방 위에 투명 캔버스를 얹는다). 그릇도 3D 장면 안에 있다.
 * 3D를 못 쓰는 경우 — 시스템 "동작 줄이기" · GL/모델 실패 · 준비가 너무 늦음 — 에는 기존 **SVG 리그**(`art/`)가 그대로 대신 그린다.
 * 모델을 불러오는 동안에는 방만 보이고 준비되면 페이드 인 한다 (2D → 3D로 바뀌는 어색한 교체를 피한다).
 *
 * 화면(GardenView)에 넘기는 값은 그대로다: 종류 · 연속 기록 · 상태 (+ 식물 경험치 · 지금 시각).
 * 모든 좌표는 방의 360 × 418 단위이고, 실제 폭에 맞춰 한 배율(k)로 늘린다.
 */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import PlantImage from "@/components/garden/PlantImage";
import Bowl from "@/components/garden/art/Bowl";
import Egg from "@/components/garden/art/Egg";
import Pet from "@/components/garden/art/Pet";
import Room, { ROOM_H, ROOM_W } from "@/components/garden/art/Room";
import SpeechBubble, { useSpeech } from "@/components/garden/art/SpeechBubble";
import PetCanvas from "@/components/garden/three/PetCanvas";
import PetErrorBoundary from "@/components/garden/three/PetErrorBoundary";
import { ROOM_LAYOUT } from "@/components/garden/three/petCanvasTypes";
import { CONDITION_LABEL, type PetCondition } from "@/logic/garden";
import { dayPartOf, isAnxious, speechLines } from "@/logic/scene";
import { getAnimalStage, type AnimalStatus, type AnimalTypeId } from "@/shared/garden-utils";
import { colors, fonts, radius } from "@/theme";

/** 동물 캔버스(정사각) 한 변과 중심 x · 바닥이 닿는 y — 방 좌표 (SVG 폴백) */
const PET_SIZE = 236;
const PET_CENTER_X = 196;
const PET_TOP = 162;
/** 식물 이미지(정사각) — 탁자 윗면(y≈296)에 밑동이 닿도록 앉힌다 */
const PLANT_SIZE = 124;
const PLANT_TOP = 190;
/** 3D 캔버스 — 방 폭을 다 덮고 위쪽은 창 아래까지만 (`ROOM_LAYOUT`이 이 영역 기준으로 조정돼 있다) */
const CANVAS_TOP = 96;
/** 3D가 이 시간 안에 준비되지 않으면 SVG를 대신 그린다 (그래도 늦게 준비되면 3D로 바뀐다) */
const FALLBACK_AFTER_MS = 4000;

export default function PetStage({
  type,
  streak,
  condition,
  totalMinutes,
  now,
  animate = true,
  active = true,
}: {
  type: AnimalTypeId;
  streak: number;
  condition: PetCondition;
  /** 식물 경험치 — 방 한쪽 화분에 자란 단계로 놓인다 */
  totalMinutes: number;
  /** 기준 시각(ms) — 창밖 하늘 · 저녁 초조함 */
  now: number;
  /** false면 정지 포즈 (스크린샷용) — 시스템 "동작 줄이기"는 각 부위가 알아서 따른다 */
  animate?: boolean;
  /** false면 3D 프레임 루프를 멈춘다 — 다른 탭에 가 있는 동안 GPU를 쓰지 않는다 */
  active?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const k = width / ROOM_W;
  const height = width * (ROOM_H / ROOM_W);
  const stage = getAnimalStage(streak).status;
  const isEgg = condition === "egg";
  const anxious = isAnxious(condition, now);
  const speech = useSpeech(speechLines(condition, type), animate && width > 0);

  // ── 3D ↔ SVG ─────────────────────────────────────────────
  const reduced = useReducedMotion();
  const [ready3d, setReady3d] = useState(false);
  const [failed3d, setFailed3d] = useState(false);
  const [late3d, setLate3d] = useState(false);
  const try3d = !reduced && !failed3d;
  useEffect(() => {
    if (!try3d || ready3d) return;
    const id = setTimeout(() => setLate3d(true), FALLBACK_AFTER_MS);
    return () => clearTimeout(id);
  }, [try3d, ready3d]);
  const showSvg = !try3d || (late3d && !ready3d);
  const fade = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));
  useEffect(() => {
    fade.set(withTiming(ready3d ? 1 : 0, { duration: 320 }));
  }, [ready3d, fade]);

  // 3D 장면에서의 성장 단계 — 알은 "밥을 한 번도 못 먹은" 상태이고, 연속 기록이 0으로 끊긴 동물(굶주림)은 아기로 보인다
  const stage3d: AnimalStatus = isEgg ? "egg" : stage === "egg" ? "baby" : stage;

  // 밥을 먹으면(출출 · 굶주림 → 배부름) 먹는 연출을 한 번 — 렌더 중에 이전 상태와 비교한다 (효과에서 setState 하지 않는다)
  const [prevCondition, setPrevCondition] = useState(condition);
  const [eatSignal, setEatSignal] = useState(0);
  if (condition !== prevCondition) {
    setPrevCondition(condition);
    if (condition === "fed" && (prevCondition === "peckish" || prevCondition === "starving")) setEatSignal((n) => n + 1);
  }
  // 동물을 누르면 쓰다듬는다 — 진행 기록은 없다 (쓰다듬기 저장 · 햅틱은 6-3 · 6-4)
  const [petSignal, setPetSignal] = useState(0);

  return (
    <View
      testID="pet-stage"
      accessibilityLabel={`${CONDITION_LABEL[condition]} 상태의 반려 동물이 사는 방`}
      onLayout={onLayout}
      style={[styles.stage, { aspectRatio: ROOM_W / ROOM_H }]}
    >
      {width > 0 ? (
        <>
          <Room width={width} height={height} dayPart={dayPartOf(now)} animate={animate} dim={condition === "starving" ? 1 : 0} />

          {/* 식물 — 탁자 위에서 자란 단계 그대로 */}
          <View pointerEvents="none" style={{ position: "absolute", left: -6 * k, top: PLANT_TOP * k }}>
            <PlantImage totalMinutes={totalMinutes} size={PLANT_SIZE * k} />
          </View>

          {/* SVG 폴백 — 밥그릇(배부르면 가득, 아니면 텅 빔) + 동물 */}
          {showSvg ? (
            <>
              <View testID="pet-svg-fallback" pointerEvents="none" style={{ position: "absolute", left: 62 * k, top: 358 * k }}>
                <Bowl width={62 * k} full={condition === "fed"} />
              </View>
              <View
                pointerEvents="none"
                style={{ position: "absolute", left: (PET_CENTER_X - PET_SIZE / 2) * k, top: PET_TOP * k, width: PET_SIZE * k, height: PET_SIZE * k }}
              >
                {isEgg ? (
                  <Egg size={PET_SIZE * k} type={type} animate={animate} />
                ) : (
                  <Pet type={type} size={PET_SIZE * k} condition={condition} stage={stage} anxious={anxious} animate={animate} />
                )}
              </View>
            </>
          ) : null}

          {/* 3D 동물 · 그릇 — 투명 캔버스. 탭은 받지 않는다 (스크롤과 다투지 않게 · 아래 Pressable이 대신 받는다) */}
          {try3d ? (
            <Animated.View
              testID="pet-3d"
              pointerEvents="none"
              style={[{ position: "absolute", left: 0, top: CANVAS_TOP * k, width, height: (ROOM_H - CANVAS_TOP) * k }, fadeStyle]}
            >
              <PetErrorBoundary onError={() => setFailed3d(true)}>
                <PetCanvas
                  type={type}
                  stage={stage3d}
                  condition={condition}
                  anxious={anxious}
                  still={!animate}
                  active={active}
                  layout={ROOM_LAYOUT}
                  eatSignal={eatSignal}
                  petSignal={petSignal}
                  onReady={() => setReady3d(true)}
                />
              </PetErrorBoundary>
            </Animated.View>
          ) : null}
          {ready3d ? <View testID="pet-3d-ready" pointerEvents="none" style={styles.marker} /> : null}

          {/* 쓰다듬기 — 3D가 그려지고 움직일 때만. 위로 끄는 스크롤은 그대로 통과한다 */}
          {ready3d && animate ? (
            <Pressable
              testID="pet-touch"
              accessibilityRole="button"
              accessibilityLabel={isEgg ? "알 쓰다듬기" : "동물 쓰다듬기"}
              onPress={() => setPetSignal((n) => n + 1)}
              style={{ position: "absolute", left: 56 * k, top: 150 * k, width: 270 * k, height: 262 * k }}
            />
          ) : null}

          {/* 말풍선 */}
          <View pointerEvents="none" style={[styles.bubbleSlot, { top: 100 * k, transform: [{ translateX: (PET_CENTER_X - ROOM_W / 2) * k }] }]}>
            <SpeechBubble text={speech} maxWidth={width * 0.72} />
          </View>

          {/* 상태 칩 */}
          <View testID="pet-condition-chip" style={styles.chip}>
            <View style={[styles.dot, { backgroundColor: condition === "fed" ? colors.brand : colors.textFaint }]} />
            <Text style={styles.chipText}>{CONDITION_LABEL[condition]}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: "100%",
    overflow: "hidden",
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgCard,
  },
  bubbleSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  /** 검증용 표식 — 3D 모델이 그려졌음을 자동 점검이 알아본다 (보이지 않는다) */
  marker: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
  chip: {
    position: "absolute",
    left: 12,
    top: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: "rgba(4, 5, 8, 0.6)",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  chipText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textPrimarySoft,
  },
});
