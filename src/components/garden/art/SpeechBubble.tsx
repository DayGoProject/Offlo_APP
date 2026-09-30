/**
 * 동물 말풍선 — 상태에 맞는 혼잣말을 가끔 띄운다 (logic/scene.ts `speechLines`).
 * 대사 전환은 JS 타이머(몇 초에 한 번)뿐이고, 등장 · 퇴장 움직임은 Reanimated가 한다.
 */
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeOut, ZoomIn } from "react-native-reanimated";

import { pickLine } from "@/logic/scene";
import { fonts } from "@/theme";

import { bubble as B } from "./palette";

/**
 * 몇 초마다 대사를 하나씩 보였다 숨긴다. `lines`가 바뀌면(상태가 바뀌면) 처음부터 다시 돈다.
 * 반환값은 지금 보일 대사 — 없으면 null.
 */
export function useSpeech(lines: readonly string[], enabled: boolean): string | null {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || lines.length === 0) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let turn = 0;

    const cycle = (delay: number) => {
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setText(pickLine(lines, turn));
          turn += 1;
          timers.push(
            setTimeout(() => {
              if (cancelled) return;
              setText(null);
              cycle(6200 + (turn % 3) * 1700);
            }, 3400),
          );
        }, delay),
      );
    };
    cycle(1500);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      // 상태가 바뀌면(대사 목록이 바뀌면) 이전 대사를 치운다
      setText(null);
    };
  }, [lines, enabled]);

  // 꺼져 있거나 대사가 없으면 남아 있던 글자도 보이지 않는다
  return enabled && lines.length > 0 ? text : null;
}

export default function SpeechBubble({ text, maxWidth }: { text: string | null; maxWidth: number }) {
  if (!text) return null;
  return (
    <Animated.View
      key={text}
      testID="pet-bubble"
      entering={ZoomIn.duration(220)}
      exiting={FadeOut.duration(180)}
      style={[styles.bubble, { maxWidth }]}
    >
      <Text style={styles.text}>{text}</Text>
      <View style={styles.tail} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: B.fill,
    borderWidth: 1,
    borderColor: B.border,
  },
  text: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: B.text,
    textAlign: "center",
  },
  // 꼬리 — 회전한 정사각형의 아래 절반만 보인다
  tail: {
    position: "absolute",
    bottom: -6,
    alignSelf: "center",
    width: 12,
    height: 12,
    backgroundColor: B.fill,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: B.border,
    transform: [{ rotate: "45deg" }],
  },
});
