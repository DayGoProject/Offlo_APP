// @ts-check
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

/**
 * 안드로이드 네이티브 빌드 산출물을 Metro 감시에서 뺀다.
 *
 * Expo 기본값은 android/app/build · android/.gradle 만 막는다. 로컬 dev build(`expo run:android`)는
 * 앱과 node_modules의 각 네이티브 라이브러리 아래 `.cxx`·`build`에 CMake 임시 폴더를 만들었다 지우는데,
 * Windows 감시기(FallbackWatcher)가 그 폴더를 쫓다가 ENOENT로 개발 서버가 죽는다.
 * 이 폴더들엔 번들에 필요한 JS가 없다.
 */
const nativeBuildDirs = /(?:^|[\\/])android[\\/](?:app[\\/])?(?:build|\.cxx|\.gradle)(?:[\\/].*)?$/;

const defaults = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(defaults) ? defaults : defaults ? [defaults] : []),
  nativeBuildDirs,
];

module.exports = config;
