/**
 * 탭 내비게이션 미리보기 — UIUX 실험 A안. 실제 앱과 **같은 탭 구성**(`StageTabsLayout`)을 로그인 없이 눌러 본다:
 * 탭 전환 · 가운데 + → 업로드 시트 → "오늘 일간 분석"이 분석 탭을 `?start=pick`으로 여는지.
 * 화면 내용은 자리 표시뿐이다 (샘플 값 · api · useAuth 금지).
 */
import StageTabsLayout from "@/components/app/StageTabsLayout";

export default function PreviewStageLayout() {
  return <StageTabsLayout analysisHref="/preview/stage/analysis" />;
}
