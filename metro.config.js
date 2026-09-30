// @ts-check
const path = require("node:path");
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

// 3D 모델(glTF 바이너리)을 이미지처럼 에셋으로 번들한다 — `require("…glb")`가 에셋 모듈을 돌려준다 (M6 3D 스파이크)
config.resolver.assetExts = [...config.resolver.assetExts, "glb"];

/**
 * `three`는 항상 ESM 빌드(`three.module.js`)로 푼다.
 *
 * R3F 네이티브(CJS)가 `require("three")`를 하면 Metro가 `three.cjs`를 고르는데, three 0.18x의 그 파일은 맨 위에서
 * `process.emitWarning(...)`을 부른다 — Hermes엔 그 함수가 없어 **앱이 `undefined is not a function`으로 죽는다**
 * (웹 · Node에서는 멀쩡해서 웹 검증으로는 안 잡힌다). ESM 하나로 고정하면 three 인스턴스가 둘로 갈라지는 일도 없다.
 */
const threeModule = path.join(__dirname, "node_modules", "three", "build", "three.module.js");
const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three") return { type: "sourceFile", filePath: threeModule };
  return (upstreamResolve ?? context.resolveRequest)(context, moduleName, platform);
};

const defaults = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(defaults) ? defaults : defaults ? [defaults] : []),
  nativeBuildDirs,
];

module.exports = config;
