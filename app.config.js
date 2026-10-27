/**
 * 동적 앱 설정 — `app.json`의 값을 그대로 받아(`config`) **production 빌드에서만** 바꿀 것을 얹는다.
 *
 * - `android.permission.SYSTEM_ALERT_WINDOW`("다른 앱 위에 표시") — Expo 템플릿이 개발용으로 매니페스트에 넣어 둔다. 개발 빌드의 도구 막대에는 쓰이지만
 *   출시 앱에는 필요 없고, 스토어 심사에서 민감 권한으로 걸린다 → production에서만 막는다 (개발 빌드는 그대로 둔다).
 *
 * production 판정: EAS 빌드(`EAS_BUILD_PROFILE=production`) 또는 로컬에서 `EXPO_APP_VARIANT=production`을 준 prebuild.
 *   EXPO_APP_VARIANT=production npx expo prebuild --platform android --no-install   # 그 다음 npx expo run:android --variant release --no-bundler
 * (개발 빌드를 다시 만들 때는 변수 없이 prebuild한다 — `android/`가 그 변수대로 만들어진다.)
 */
const PRODUCTION = process.env.EAS_BUILD_PROFILE === "production" || process.env.EXPO_APP_VARIANT === "production";

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    blockedPermissions: [...(config.android?.blockedPermissions ?? []), ...(PRODUCTION ? ["android.permission.SYSTEM_ALERT_WINDOW"] : [])],
  },
});
