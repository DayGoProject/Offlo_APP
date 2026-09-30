// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // R3F는 `<mesh position intensity object …>`처럼 three 객체의 속성을 JSX로 쓴다 — DOM 속성 검사가 오탐한다.
    // 모델(.glb)은 Metro 에셋이라 `require`로만 불러온다.
    files: ["src/components/garden/three/**"],
    rules: {
      "react/no-unknown-property": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
