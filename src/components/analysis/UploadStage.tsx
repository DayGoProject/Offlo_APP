/**
 * 업로드 무대 — 웹 분석 페이지의 점선 카드. 상태에 따라 안의 내용만 바뀐다.
 *
 *   idle        스크린샷 고르기 (흰 알약 — 화면의 주 행동)
 *   picked      고른 사진 미리보기 · AI 분석 시작 · 다시 고르기
 *   busy        이미지 준비 · AI 분석 · 저장 중 (준비 · 분석은 취소할 수 있다)
 *   save-failed 분석은 끝났고 저장만 남음 — 저장만 다시 시도 (AI를 다시 부르지 않는다)
 *   done        오늘 분석 완료 — 오늘 결과 보기
 */
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

import { CheckIcon, InfoIcon, UploadIcon } from "@/components/app/Icons";
import Pill from "@/components/app/Pill";
import type { UploadPhase } from "@/logic/analysis";
import { colors, em, fonts, radius } from "@/theme";

export type StageKind = "idle" | "picked" | "busy" | "save-failed" | "done";

const BUSY_TEXT: Partial<Record<UploadPhase, { title: string; sub: string }>> = {
  preparing: { title: "이미지 준비 중…", sub: "사진을 줄이고 있어요" },
  analyzing: { title: "AI가 분석하고 있어요", sub: "보통 20~40초 걸려요 · 끝날 때까지 앱을 열어 두세요" },
  saving: { title: "결과 저장 중…", sub: "거의 다 됐어요" },
};

export default function UploadStage({
  kind,
  phase,
  image,
  onPick,
  onAnalyze,
  onCancel,
  onRetrySave,
  onDiscard,
  onOpenToday,
}: {
  kind: StageKind;
  phase: UploadPhase;
  /** 고른 사진 — 기기 안의 주소 */
  image: string | null;
  onPick: () => void;
  onAnalyze: () => void;
  onCancel: () => void;
  onRetrySave: () => void;
  onDiscard: () => void;
  onOpenToday: () => void;
}) {
  let body: ReactNode;

  if (kind === "done") {
    body = (
      <>
        <Badge>
          <CheckIcon color={colors.brand} />
        </Badge>
        <Texts
          title="오늘 분석을 마쳤어요"
          sub="일간 분석은 하루에 한 번만 가능합니다. 내일 다시 스크린타임 스크린샷을 올려주세요."
        />
        <Pill testID="open-today-result" label="오늘 결과 보기" variant="primary" onPress={onOpenToday} />
      </>
    );
  } else if (kind === "busy") {
    const text = BUSY_TEXT[phase] ?? BUSY_TEXT.analyzing!;
    body = (
      <>
        <ActivityIndicator testID="analysis-busy" size="large" color={colors.brand} />
        <Texts title={text.title} sub={text.sub} />
        {phase !== "saving" ? <Pill testID="cancel-analysis" label="취소" onPress={onCancel} /> : null}
      </>
    );
  } else if (kind === "save-failed") {
    body = (
      <>
        <Badge>
          <InfoIcon color={colors.brand} size={22} />
        </Badge>
        <Texts
          title="분석은 끝났어요 · 저장만 남았어요"
          sub="결과를 저장하지 못했어요. 분석을 다시 하지 않고 저장만 다시 시도해요."
        />
        <View style={styles.actions}>
          <Pill testID="retry-save" label="저장 다시 시도" variant="accent" onPress={onRetrySave} />
          <Pill label="결과 버리기" onPress={onDiscard} />
        </View>
      </>
    );
  } else if (kind === "picked" && image !== null) {
    body = (
      <>
        <Image
          testID="picked-image"
          source={image}
          contentFit="contain"
          style={styles.preview}
          accessibilityLabel="고른 스크린샷"
        />
        <View style={styles.actions}>
          <Pill testID="start-analysis" label="AI 분석 시작" variant="accent" onPress={onAnalyze} />
          <Pill label="다시 고르기" onPress={onPick} />
        </View>
      </>
    );
  } else {
    body = (
      <>
        <Badge>
          <UploadIcon color={colors.brand} />
        </Badge>
        <Texts
          title="스크린타임 스크린샷을 골라주세요"
          sub="설정 → 스크린타임의 '일' 탭 화면을 캡처한 뒤 사진에서 골라주세요"
        />
        <Pill testID="pick-screenshot" label="스크린샷 고르기" variant="primary" onPress={onPick} />
        <View style={styles.note}>
          <InfoIcon color={colors.textMuted} />
          <Text style={styles.noteText}>이미지는 분석 즉시 폐기되며 저장되지 않습니다</Text>
        </View>
      </>
    );
  }

  return (
    <View testID={`stage-${kind}`} style={styles.stage}>
      {body}
    </View>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <View style={styles.badge}>{children}</View>;
}

function Texts({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={styles.texts}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{sub}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  stage: {
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingHorizontal: 22,
    paddingVertical: 36,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgCard,
    overflow: "hidden",
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  texts: {
    alignItems: "center",
    gap: 7,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: em(18, -0.015),
    color: colors.textPrimary,
    textAlign: "center",
  },
  sub: {
    maxWidth: 320,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  preview: {
    width: "100%",
    height: 320,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderCard,
  },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  noteText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
  },
});
