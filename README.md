<div align="center">

# 📱 Offlo APP

### AI 기반 디지털 디톡스 플랫폼 — iOS 앱

[Offlo 웹](https://github.com/DayGoProject/Offlo2)의 모바일 클라이언트입니다.

![Expo](https://img.shields.io/badge/Expo-SDK_57-000020?style=flat-square&logo=expo)
![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?style=flat-square&logo=typescript)
![iOS](https://img.shields.io/badge/iOS-15.1+-000000?style=flat-square&logo=apple)

</div>

---

## 소개

스마트폰 스크린타임 스크린샷을 AI가 분석하고, 반려 식물·동물을 키우며
건강한 디지털 습관을 만드는 앱입니다. 아이폰을 우선 지원합니다.

웹에서는 스크린샷을 PC로 옮겨야 했지만, 앱에서는 사진 앱의 최근 스크린샷을
바로 집어올 수 있습니다.

## 개발 진행 상황

`▰▱▱▱▱▱▱▱▱` **1 / 9 완료** — 기반 구축을 마치고 인증 단계에 들어갑니다.

| 단계 | 내용 | 상태 |
|:---:|------|:---:|
| **M1** | 저장소 · 기반 구축 (공유 코드 · 테마 · 폰트 · Expo 부팅) | ✅ **완료** |
| **M2** | 인증 (Firebase + AsyncStorage · Google 로그인) | 🚧 **진행 중** |
| M3 | API 연동 계층 (클라이언트 통합 · 타임아웃 · 재시도) | 🔲 예정 |
| M4 | 내비게이션 + 대시보드 · 분석 기록 | 🔲 예정 |
| M5 | AI 분석 (사진 선택 · 압축 · 결과 · 코치 채팅) | 🔲 예정 |
| M6 | 정원 (식물 · 동물 · 제스처 · 햅틱) | 🔲 예정 |
| M7 | 목표 · 배지 · 커뮤니티 | 🔲 예정 |
| M8 | Apple 로그인 + 알림 | 🔲 예정 |
| M9 | QA · TestFlight 배포 | 🔲 예정 |
| M10 | iOS 앱 차단 (FamilyControls) | ⏸️ 보류 |


<details>
<summary><b>M1 — 저장소 · 기반 구축</b> (2026-09-05 완료)</summary>

- Expo SDK 57 (RN 0.86 / React 19.2) · expo-router · TypeScript strict
- 디자인 토큰(`src/theme.ts`) + 다크/라이트 테마 컨텍스트 — 웹과 같은 색 3개 체계
- 스포카 한 산스 네오 3종 런타임 로드 (Expo Go에서도 동일하게 적용되도록)
- 웹 저장소와의 공유 코드 드리프트 감지 (`scripts/sync-shared.mjs`)
- 스타일 방식 확정 — **토큰 + StyleSheet** (NativeWind 미도입)
- 검증 3층 통과 — RN Web(Playwright) · Android 에뮬레이터(adb) · **아이폰 Expo Go 실기기**

</details>

## 저장소 구성

| 저장소 | 역할 |
|--------|------|
| [Offlo2](https://github.com/DayGoProject/Offlo2) | 웹 + **API 서버** (Next.js) · Chrome 확장 |
| **Offlo_APP** (이 저장소) | iOS/Android 앱 (Expo) |

앱은 자체 백엔드를 갖지 않습니다. 모든 데이터는 웹 저장소의 Next.js API Routes를
`Authorization: Bearer <Firebase ID Token>` 으로 호출해 주고받습니다.

## 공유 코드

정원 레벨·배지 정의 등 웹과 표시 기준이 같아야 하는 코드는 `src/shared/` 에 복사본으로 둡니다.
**원본은 언제나 웹 저장소(`web/src/lib/`)** 이며, 직접 수정하지 않습니다.

```bash
node scripts/sync-shared.mjs          # 웹과 비교 (다르면 exit 1)
node scripts/sync-shared.mjs --pull   # 웹 원본으로 갱신
```

두 저장소가 나란히 있지 않다면 `OFFLO_WEB_ROOT` 환경변수로 웹 경로를 지정합니다.

## 개발

```bash
npm install
npx expo start           # QR 스캔 → Expo Go
npx expo start --android # Android 에뮬레이터
npx expo start --web     # 브라우저 (레이아웃 확인용)

npm run verify:M1        # 회귀 검증 — 웹(Playwright) + 안드로이드 에뮬레이터(adb)
npm run sync-shared      # 웹 저장소와 공유 코드 비교
```

**요구 사항**: Node.js 22 LTS 이상 (개발 PC 기준 v24.19.0)

## 보안

`EXPO_PUBLIC_*` 접두사가 붙은 값은 **앱 번들에 평문으로 포함됩니다.**
Firebase 클라이언트 config는 공개 전제라 괜찮지만, 서버 전용 키
(`GEMINI_API_KEY` · `FIREBASE_SERVICE_ACCOUNT_KEY` · `SUPABASE_SERVICE_ROLE_KEY`)는
**어떤 경우에도 이 저장소에 두지 않습니다.** AI 호출은 웹 API Routes(`/api/ai/*`)를 경유합니다.
