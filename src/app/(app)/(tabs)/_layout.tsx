/**
 * 하단 탭 — 홈 · 분석 · [+] · 정원 · 커뮤니티 (UIUX 실험 A안 · 브랜치 `exp/uiux-a-stage`).
 * 구성은 `StageTabsLayout`에 있다 (로그인 없이 눌러 보는 미리보기 `/preview/stage`와 같은 코드).
 */
import StageTabsLayout from "@/components/app/StageTabsLayout";

export default function TabsLayout() {
  return <StageTabsLayout analysisHref="/analysis" />;
}
