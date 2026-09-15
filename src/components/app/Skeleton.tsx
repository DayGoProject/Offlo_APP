/**
 * 로딩 자리표시 — 웹 `animate-pulse` 대응. 은은하게 깜빡이는 `--bg-bar` 블록.
 */
import { useEffect, useState } from "react";
import { Animated, Platform, StyleSheet, type DimensionValue } from "react-native";

import { colors } from "@/theme";

export default function Skeleton({
  width = "100%",
  height,
  radius = 8,
  testID,
}: {
  width?: DimensionValue;
  height: number;
  radius?: number;
  testID?: string;
}) {
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const useNativeDriver = Platform.OS !== "web";
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 900, useNativeDriver }),
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      testID={testID}
      accessibilityLabel="불러오는 중"
      style={[styles.block, { width, height, borderRadius: radius, opacity }]}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.bgBar,
  },
});
