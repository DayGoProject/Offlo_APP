/**
 * 동물 위의 터치면 — **탭**(톡) 과 **문지르기**(좌우로 쓱쓱)를 받는다.
 *
 * 3D 캔버스는 `pointerEvents="none"`이라 터치를 못 받는다 (R3F 네이티브 캔버스는 터치 응답자를 가로채 위로 끄는 스크롤을 막는다).
 * 그래서 투명한 이 면이 대신 받는다. 제스처 라이브러리 없이 RN 기본 터치 응답 시스템만 쓴다 — 새 네이티브 의존성이 없고 웹에서도 같다.
 *
 *  · 거의 안 움직이고 뗐다 → `onTap`
 *  · 가로로 `STEP_PX`만큼 움직일 때마다 → `onStrokeTick` (햅틱 틱 · 반응 이어가기), 뗐을 때 `onStrokeEnd`
 *  · 위아래로 끌면 스크롤이 응답자를 가져간다 (`onResponderTerminationRequest`) — 이 면이 스크롤을 막지 않는다
 */
import { useRef } from "react";
import { View, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";

/** 문지르며 이만큼(dp) 움직일 때마다 한 구간 */
const STEP_PX = 34;
/** 이보다 덜 움직이고 뗐으면 탭 */
const TAP_SLOP = 10;
/** 구간 틱 사이 최소 간격(ms) — 빠르게 문질러도 진동이 뭉개지지 않게 */
const MIN_TICK_GAP_MS = 70;

interface Gesture {
  startX: number;
  startY: number;
  lastX: number;
  /** 가로로 움직인 총 거리 (왕복 포함) */
  travel: number;
  /** 세로로 가장 멀리 간 거리 */
  dy: number;
  ticks: number;
  lastTickAt: number;
}

const fresh = (x = 0, y = 0): Gesture => ({ startX: x, startY: y, lastX: x, travel: 0, dy: 0, ticks: 0, lastTickAt: 0 });

export default function PetTouch({
  onTap,
  onStrokeTick,
  onStrokeEnd,
  label,
  style,
  testID = "pet-touch",
}: {
  /** 톡 — 한 번 닿았다 */
  onTap: () => void;
  /** 문지르는 중 구간 하나를 지났다 (`ticks` = 지금까지 지난 구간 수) */
  onStrokeTick: (ticks: number) => void;
  /** 문지르기를 마쳤다 (`ticks` = 지난 구간 수, 1 이상) */
  onStrokeEnd: (ticks: number) => void;
  label: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const g = useRef<Gesture>(fresh());

  const onGrant = (e: GestureResponderEvent) => {
    g.current = fresh(e.nativeEvent.pageX, e.nativeEvent.pageY);
  };
  const onMove = (e: GestureResponderEvent) => {
    const s = g.current;
    const { pageX, pageY } = e.nativeEvent;
    s.travel += Math.abs(pageX - s.lastX);
    s.lastX = pageX;
    s.dy = Math.max(s.dy, Math.abs(pageY - s.startY));
    const now = Date.now();
    if (Math.floor(s.travel / STEP_PX) > s.ticks && now - s.lastTickAt >= MIN_TICK_GAP_MS) {
      s.ticks += 1;
      s.lastTickAt = now;
      onStrokeTick(s.ticks);
    }
  };
  const onRelease = () => {
    const s = g.current;
    g.current = fresh();
    if (s.ticks > 0) onStrokeEnd(s.ticks);
    else if (s.travel < TAP_SLOP && s.dy < TAP_SLOP) onTap();
  };

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityActions={[{ name: "activate" }]}
      onAccessibilityAction={onTap}
      onStartShouldSetResponder={() => true}
      onResponderGrant={onGrant}
      onResponderMove={onMove}
      onResponderRelease={onRelease}
      onResponderTerminate={() => {
        g.current = fresh();
      }}
      // 위아래로 끌면 스크롤이 가져가도록 — 이 면이 스크롤을 막지 않는다
      onResponderTerminationRequest={() => true}
      style={style}
    />
  );
}
