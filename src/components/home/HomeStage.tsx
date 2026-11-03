/**
 * 홈 — 몰입형 스테이지 (UIUX 실험 A안 · 브랜치 `exp/uiux-a-stage`). 데이터는 props로만 받는다 (mobile.md "웹 미리보기 — 미리보기 화면").
 * `app/(app)/(tabs)/index.tsx`는 불러오기를, `app/preview/home.tsx`는 샘플 값을 넘긴다. 이 파일은 `api` · `useAuth` · Firebase를 import하지 않는다.
 *
 * 숫자 대시보드 대신 **동물이 사는 방**이 화면의 주인공이다 — 위에서 아래로:
 *   방 장면(상태바 밑까지 꽉 채움 · 동물을 톡 누르면 쓰다듬기) → 아래로 번지는 어둠 → 제목 · 한 줄 · **오늘 할 일 버튼 하나** → (떠 있는) 미션 미니 바
 * 오른쪽 위에 알림 종 · 프로필(= 예전 '더보기'). 자세한 숫자는 분석 탭으로 옮겨 간다.
 *
 * 간격은 8pt 격자(8 · 16 · 24 · 32)이고, 글자는 28 / 15 / 13 세 가지 크기만 쓴다.
 */
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import CircleButton from "@/components/app/CircleButton";
import ErrorNotice from "@/components/app/ErrorNotice";
import { ProfileIcon } from "@/components/app/HeaderIcons";
import { UploadIcon } from "@/components/app/Icons";
import Pill from "@/components/app/Pill";
import Room, { ROOM_H, ROOM_W } from "@/components/garden/art/Room";
import PetStage from "@/components/garden/PetStage";
import MissionMiniBar from "@/components/home/MissionMiniBar";
import NotificationBell from "@/components/notifications/NotificationBell";
import type { AffectionControls } from "@/hooks/use-pet-affection";
import type { AnalysisRecords } from "@/logic/analysis";
import { todayDaily } from "@/logic/analysis";
import { conditionCopy, petCondition, streakOutlook } from "@/logic/garden";
import { homeSubline, miniMission } from "@/logic/home";
import { missionBoard, type WeekStatus } from "@/logic/mission";
import { dayPartOf } from "@/logic/scene";
import type { GardenSnapshot } from "@/services/api-types";
import { ANIMAL_TYPES } from "@/shared/garden-utils";
import { colors, fonts, radius } from "@/theme";

/** 미션 미니 바(84)가 위에 떠 있을 때 본문 아래 여백 — 버튼이 미니 바에 닿지 않게 16 더 띄운다 */
const BODY_BOTTOM_WITH_MINI = 100;

export interface HomeStageProps {
  /** 기준 시각(ms) — 동물 상태의 "오늘"(KST) */
  now: number;
  data: GardenSnapshot | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  /** 오늘 분석 여부 · 미션의 주간 줄에 쓴다 — 못 불러왔으면 null */
  records: AnalysisRecords | null;
  weekStatus: WeekStatus;
  animate?: boolean;
  /** false면 3D 프레임 루프를 멈춘다 (다른 탭에 가 있을 때) */
  active?: boolean;
  /** 쓰다듬기 · 친밀도 — 없으면 화면 효과만 있고 미션 미니 바도 없다 */
  affection?: AffectionControls | null;
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  /** "오늘 분석하기" — 사진 고르기를 바로 연다 */
  onUpload: () => void;
  onOpenToday: (analysisId: string) => void;
  /** 정원 탭으로 (동물 고르기 · 미션 보기) */
  onOpenGarden: () => void;
}

export default function HomeStage(props: HomeStageProps) {
  const { now, data, loading, error, onRetry, records, weekStatus, animate = true, active = true, affection = null } = props;
  const insets = useSafeAreaInsets();

  // 처음 불러오다 실패 — 보여줄 것이 없다
  if (!data && error && !loading) {
    return (
      <View testID="home" style={[styles.center, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>홈을 불러오지 못했어요</Text>
        <ErrorNotice testID="home-error" message={error} onRetry={onRetry} />
      </View>
    );
  }

  if (!data) {
    return (
      <View testID="home" style={styles.root}>
        <View testID="home-skeleton" style={[styles.skeletonStage, { aspectRatio: ROOM_W / ROOM_H }]} />
        <View style={styles.body}>
          <View style={[styles.skelLine, { width: "70%", height: 32 }]} />
          <View style={[styles.skelLine, { width: "50%", height: 16 }]} />
        </View>
      </View>
    );
  }

  const animal = data.animal;
  const type = animal?.type ?? null; // 동물 문서는 있어도 종류를 아직 안 골랐을 수 있다 (정원 화면과 같은 판단)
  const condition = petCondition(animal, now);
  const copy = conditionCopy(condition, animal ? streakOutlook(animal, condition) : null);
  const today = records ? todayDaily(records.daily, now) : null;
  const emoji = ANIMAL_TYPES.find((t) => t.id === type)?.emoji ?? "🐾";
  const board = animal && type && affection ? missionBoard({ condition, petToday: affection.view.today, records, weekStatus, now }) : null;

  const cta =
    !animal || !type ? (
      <Cta testID="home-cta" label="함께할 동물 고르기" onPress={props.onOpenGarden} />
    ) : condition === "fed" && today ? (
      <Cta testID="home-cta" label="오늘 결과 보기" variant="ghost" onPress={() => props.onOpenToday(today.id)} />
    ) : (
      <Cta testID="home-cta" label={condition === "egg" ? "첫 분석으로 부화시키기" : "오늘 분석하기"} icon onPress={props.onUpload} />
    );

  return (
    <View testID="home" style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRetry} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.bgCard} />}
      >
        {/* 방 장면 — 상태바 밑까지 올라간다. 아래쪽은 어둠으로 번져 글자가 앉을 자리가 된다 */}
        <View>
          {animal && type ? (
            <PetStage
              type={type}
              streak={animal.streak}
              condition={condition}
              totalMinutes={data.totalDetoxMinutes}
              now={now}
              animate={animate}
              active={active}
              onPet={affection?.tap}
              bleed
              chipTop={insets.top + 8}
            />
          ) : (
            <EmptyRoom now={now} />
          )}
          <Fade />
          <View style={[styles.topButtons, { top: insets.top + 4 }]}>
            <View style={styles.roundBtn}>
              <NotificationBell unread={props.unreadCount} onPress={props.onOpenNotifications} />
            </View>
            <CircleButton testID="home-profile" label="내 계정" glass onPress={props.onOpenProfile}>
              <ProfileIcon color={colors.textPrimary} />
            </CircleButton>
          </View>
        </View>

        {/* 제목 · 한 줄은 장면 바로 아래, 버튼은 엄지가 닿는 아래쪽 (미션 바 위) — 키가 큰 폰에서는 둘 사이가 벌어진다 */}
        <View style={[styles.body, { paddingBottom: board ? BODY_BOTTOM_WITH_MINI : 32 }]}>
          <View style={styles.texts}>
            <Text testID="home-title" accessibilityRole="header" style={styles.title}>
              {copy.headline}
            </Text>
            <Text testID="home-sub" style={styles.sub}>
              {homeSubline(today, copy.sub)}
            </Text>
          </View>
          <View style={styles.ctaRow}>{cta}</View>
        </View>
      </ScrollView>

      {board ? (
        <View style={styles.mini} pointerEvents="box-none">
          <MissionMiniBar mission={miniMission(board)} emoji={emoji} onPress={props.onOpenGarden} />
        </View>
      ) : null}
    </View>
  );
}

/** 동물을 아직 고르지 않았을 때의 빈 방 — 화면 폭에 맞춰 늘린다 (`PetStage`와 같은 비율) */
function EmptyRoom({ now }: { now: number }) {
  const [width, setWidth] = useState(0);
  return (
    <View testID="home-empty-room" onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))} style={{ width: "100%", aspectRatio: ROOM_W / ROOM_H, overflow: "hidden" }}>
      {width > 0 ? <Room width={width} height={width * (ROOM_H / ROOM_W)} dayPart={dayPartOf(now)} animate={false} dim={0} /> : null}
    </View>
  );
}

/** 방 장면 아래쪽을 바탕색으로 번지게 한다 — 장면과 글자 사이의 이음매를 지운다 */
function Fade() {
  return (
    <View pointerEvents="none" style={styles.fade}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="homeFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.bgPage} stopOpacity="0" />
            <Stop offset="1" stopColor={colors.bgPage} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#homeFade)" />
      </Svg>
    </View>
  );
}

/** 오늘 할 일 한 가지 — 엄지가 닿는 아래쪽, 화면의 유일한 흰 알약 */
function Cta({ testID, label, icon = false, variant = "primary", onPress }: { testID: string; label: string; icon?: boolean; variant?: "primary" | "ghost"; onPress: () => void }) {
  if (variant === "ghost") return <Pill testID={testID} label={label} onPress={onPress} />;
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.9 : 1 }]}>
      {icon ? <UploadIcon color={colors.bgPage} size={20} /> : null}
      <Text style={styles.ctaText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1, // 화면이 남으면 본문이 늘어나 버튼이 아래로 내려간다 · 모자라면 스크롤
  },
  center: {
    flex: 1,
    gap: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.bgPage,
  },
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "42%",
  },
  topButtons: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    gap: 8,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderCard,
    backgroundColor: colors.glass,
  },
  body: {
    flexGrow: 1,
    justifyContent: "space-between",
    gap: 24,
    marginTop: -48, // 방 아래쪽의 번진 어둠 위에 글자를 앉힌다
    paddingHorizontal: 24,
  },
  texts: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    textAlign: "center",
    fontFamily: fonts.semibold,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.6,
    color: colors.textPrimary,
  },
  sub: {
    textAlign: "center",
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textPrimarySoft,
  },
  ctaRow: {
    alignSelf: "stretch",
    alignItems: "center",
  },
  cta: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: "#FFFFFF",
  },
  ctaText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.bgPage,
  },
  mini: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  skeletonStage: {
    width: "100%",
    backgroundColor: colors.bgCard,
  },
  skelLine: {
    borderRadius: 8,
    backgroundColor: colors.bgBar,
  },
});
