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
```

**요구 사항**: Node.js 22 LTS 이상 (개발 PC 기준 v24.19.0)

## 보안

`EXPO_PUBLIC_*` 접두사가 붙은 값은 **앱 번들에 평문으로 포함됩니다.**
Firebase 클라이언트 config는 공개 전제라 괜찮지만, 서버 전용 키
(`GEMINI_API_KEY` · `FIREBASE_SERVICE_ACCOUNT_KEY` · `SUPABASE_SERVICE_ROLE_KEY`)는
**어떤 경우에도 이 저장소에 두지 않습니다.** AI 호출은 웹 API Routes(`/api/ai/*`)를 경유합니다.
