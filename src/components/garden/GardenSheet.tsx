/**
 * 정원의 바닥 시트 — 방 장면이 화면 전체의 주인공이고, 카드들은 그 아래에서 끌어 올리는 시트에 담긴다 (UIUX 실험 A안).
 *
 *   접힘  시트 윗선이 방 바닥 근처에 걸린다 — 방 전체 + 제목 · 오늘 할 일이 보이고, 그 아래 카드가 살짝 엿보인다
 *   펼침  시트가 상태바 근처까지 올라온다 — 안의 카드(미션 · 친밀도 · 성장 · 식물)를 스크롤해서 본다
 *
 * 손잡이 줄(+ 제목)을 **끌거나 누르면** 접고 펼친다. 제스처 라이브러리 없이 RN 터치 응답 시스템만 쓴다 (PetTouch와 같은 방식 · 웹도 같다).
 * 진행도 하나(0 = 접힘 · 1 = 펼침)가 공유 값이라 UI 스레드에서 움직이고, 놓을 때 속도로 어느 쪽에 붙을지 정한다.
 * 이 파일은 `api` · `useAuth` · Firebase를 import하지 않는다 (props만).
 */
import { useMemo, useState, type ReactNode } from "react";
import { PanResponder, Pressable, RefreshControl, ScrollView, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { colors, radius } from "@/theme";

/** 접힌 시트가 방 바닥을 덮는 높이 — 둥근 모서리 뒤로 방 바닥이 이어 보이게 */
const ROOM_OVERLAP = 16;
/** 접혔을 때 제목 줄 아래로 최소한 보여 줄 높이 — 첫 카드의 윗부분이 엿보인다 */
const MIN_PEEK = 150;
/** 놓을 때 이 속도(dp/ms)보다 빠르면 방향으로 붙는다 */
const FLING_V = 0.4;
/** 이만큼(dp)보다 덜 움직이고 놓으면 "누름" — 접기/펼치기 토글 */
const TAP_SLOP = 6;

export default function GardenSheet({
  height,
  roomBottom,
  topInset,
  header,
  children,
  defaultExpanded = false,
  refreshing = false,
  onRefresh,
  onExpandedChange,
}: {
  /** 시트가 놓이는 영역의 높이(dp) — 하단 탭바 위까지 */
  height: number;
  /** 방 장면 아래 가장자리의 y(dp) — 접힌 시트의 윗선이 여기에 걸린다 */
  roomBottom: number;
  /** 펼친 시트 위로 남겨 둘 높이 — 상태바 + 버튼 줄 */
  topInset: number;
  /** 손잡이 밑의 고정 영역 (눈썹 · 제목) — 여기도 끌 수 있다 */
  header: ReactNode;
  /** 스크롤되는 카드들 */
  children: ReactNode;
  defaultExpanded?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const reduced = useReducedMotion();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [headH, setHeadH] = useState(0);
  const progress = useSharedValue(defaultExpanded ? 1 : 0);
  const startP = useSharedValue(0); // 끌기를 시작할 때의 진행도

  const sheetH = Math.max(0, height - topInset);
  // 접힌 윗선 — 방 바닥에 걸되, 제목 줄 + 엿보기 높이는 늘 화면 안에 남긴다
  const collapsedTop = Math.max(topInset + 80, Math.min(roomBottom - ROOM_OVERLAP, height - (headH + MIN_PEEK)));
  const offset = Math.max(1, collapsedTop - topInset); // 접혔을 때 아래로 밀리는 거리

  const settle = (open: boolean) => {
    progress.set(withTiming(open ? 1 : 0, { duration: reduced ? 0 : 260 }));
    setExpanded(open);
    onExpandedChange?.(open);
  };

  // 끌기 — 제목 줄에서 시작한 세로 움직임만 받는다. 시작 진행도는 클로저가 아니라 제스처마다 읽는다
  const pan = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startP.set(progress.get());
      },
      onPanResponderMove: (_e, g) => {
        progress.set(Math.min(1, Math.max(0, startP.get() - g.dy / offset)));
      },
      onPanResponderRelease: (_e, g) => {
        if (Math.abs(g.dy) < TAP_SLOP && Math.abs(g.dx) < TAP_SLOP) {
          settle(startP.get() < 0.5);
          return;
        }
        const p = progress.get();
        settle(g.vy < -FLING_V ? true : g.vy > FLING_V ? false : p > 0.5);
      },
      onPanResponderTerminate: () => {
        settle(progress.get() > 0.5);
      },
    });
    // settle은 매 렌더 새로 만들어지지만 진행도 · 오프셋만 읽는다 — 오프셋이 바뀔 때(레이아웃)만 응답자를 다시 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.get(), [0, 1], [offset, 0]) }],
  }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0, 1], [0, 0.55]) }));

  const onHeadLayout = (e: LayoutChangeEvent) => setHeadH(Math.round(e.nativeEvent.layout.height));

  return (
    <>
      {/* 펼쳤을 때 방을 어둡게 — 위쪽 방 조각을 누르면 접힌다 */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} />
      {expanded ? (
        <Pressable
          testID="garden-sheet-dim"
          accessibilityRole="button"
          accessibilityLabel="카드 접기"
          onPress={() => settle(false)}
          style={[StyleSheet.absoluteFill, { bottom: sheetH }]}
        />
      ) : null}

      <Animated.View testID="garden-sheet" aria-expanded={expanded} style={[styles.sheet, { top: topInset, height: sheetH }, sheetStyle]}>
        <View onLayout={onHeadLayout} {...pan.panHandlers} testID="garden-sheet-handle" accessible accessibilityRole="button" accessibilityLabel={expanded ? "카드 접기" : "카드 펼치기"} style={styles.head}>
          <View style={styles.grip} />
          {header}
        </View>
        <ScrollView
          testID="garden-sheet-scroll"
          scrollEnabled={expanded}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} progressBackgroundColor={colors.bgCard} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  dim: {
    backgroundColor: colors.scrim,
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.borderCard,
    backgroundColor: colors.bgPage,
    overflow: "hidden",
  },
  head: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    gap: 4,
  },
  grip: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 14,
    backgroundColor: colors.borderStrong,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 48, // 가운데 올리기 버튼이 탭바 위로 솟아 있어 마지막 카드를 가리지 않게
    gap: 16,
  },
});
