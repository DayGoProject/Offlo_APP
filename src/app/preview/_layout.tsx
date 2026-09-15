/**
 * 미리보기 화면 — 로그인 가드 밖 (검증 층 ① 전용, mobile.md "웹 미리보기 — 미리보기 화면").
 *
 * 이 폴더의 화면은 `api` · `useAuth` · Firebase를 import하지 않는다 — 샘플 값만 그린다 (security.md).
 * 웹 미리보기(RN Web)는 CORS 때문에 실제 API를 부를 수 없어서, 레이아웃은 여기서 자동 점검한다.
 */
import { Stack } from "expo-router";

import { colors } from "@/theme";

export default function PreviewLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bgPage } }} />;
}
