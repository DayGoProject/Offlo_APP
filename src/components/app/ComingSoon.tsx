/**
 * 아직 만들지 않은 탭의 자리 — 탭 구조(M4)를 먼저 세우고 내용은 해당 단계에서 채운다.
 */
import { StyleSheet, Text } from "react-native";

import Card from "@/components/app/Card";
import PageHeader from "@/components/app/PageHeader";
import Screen from "@/components/app/Screen";
import { colors, fonts } from "@/theme";

export default function ComingSoon({
  title,
  milestone,
  description,
  testID,
}: {
  title: string;
  /** 예: "M5" */
  milestone: string;
  description: string;
  testID?: string;
}) {
  return (
    <Screen testID={testID} underTabBar>
      <PageHeader eyebrow={`${milestone}에서 열려요`} title={title} />
      <Card>
        <Text style={styles.text}>{description}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
});
