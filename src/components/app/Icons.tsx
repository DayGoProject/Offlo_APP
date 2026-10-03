/**
 * 화면 안의 작은 아이콘 — 웹 분석 · 결과 · 채팅 화면의 인라인 SVG를 그대로 옮겼다 (세선 · 둥근 끝).
 * 색은 부르는 쪽이 준다. 탭바 아이콘은 TabIcons.tsx.
 */
import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

type IconProps = { color: ColorValue; size?: number };

/** 업로드 무대 — 위 화살표 + 바닥선 (24 뷰박스) */
export function UploadIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 17V6M7.5 10.5 12 6l4.5 4.5" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 19h16" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

/** 완료 체크 (24 뷰박스) */
export function CheckIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.6 9.8 17.4 19 6.8" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** 추천 목록의 작은 체크 (14 뷰박스) */
export function SmallCheckIcon({ color, size = 14 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M2.4 7.2 5.6 10.4 11.6 4" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** 핵심 문제 — 경고 삼각형 */
export function WarnIcon({ color, size = 15 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M8 1.4 14.6 13H1.4L8 1.4z" stroke={color} strokeWidth={1.3} strokeLinejoin="round" />
      <Path d="M8 6v3" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
      <Circle cx={8} cy={11} r={0.7} fill={color} />
    </Svg>
  );
}

/** 원인 — 물음표 원 */
export function WhyIcon({ color, size = 15 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Circle cx={8} cy={8} r={6.4} stroke={color} strokeWidth={1.3} />
      <Path d="M6.2 6.2a1.9 1.9 0 1 1 2.4 2.2c-.4.2-.6.5-.6.9v.3" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
      <Circle cx={8} cy={11.6} r={0.7} fill={color} />
    </Svg>
  );
}

/** 안내 — 느낌표 원 */
export function InfoIcon({ color, size = 13 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Circle cx={7} cy={7} r={5.8} stroke={color} strokeWidth={1.2} />
      <Path d="M7 4.2v3.2" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      <Circle cx={7} cy={9.6} r={0.7} fill={color} />
    </Svg>
  );
}

/** 이미지 첨부 */
export function ImageIcon({ color, size = 15 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Rect x={1.8} y={2.8} width={12.4} height={10.4} rx={2} stroke={color} strokeWidth={1.3} />
      <Circle cx={5.6} cy={6.4} r={1.2} stroke={color} strokeWidth={1.2} />
      <Path d="M2.4 11.2 6 8l3 2.6 2.2-1.8 2.4 2.4" stroke={color} strokeWidth={1.3} strokeLinejoin="round" />
    </Svg>
  );
}

/** 보내기 — 위 화살표 */
export function SendIcon({ color, size = 15 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M8 13V3M3.6 7.4 8 3l4.4 4.4" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** 닫기 · 첨부 취소 */
export function CloseIcon({ color, size = 13 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M3.6 3.6l8.8 8.8M12.4 3.6l-8.8 8.8" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

/** 소리 켜짐 — 스피커 + 음파 (16 뷰박스) */
export function SoundOnIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M2.4 6.2h2.1L8 3.4v9.2L4.5 9.8H2.4z" stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
      <Path d="M10.4 6a2.9 2.9 0 0 1 0 4M12.2 4.4a5.3 5.3 0 0 1 0 7.2" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
    </Svg>
  );
}

/** 소리 꺼짐 — 스피커 + 가위표 (16 뷰박스) */
export function SoundOffIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M2.4 6.2h2.1L8 3.4v9.2L4.5 9.8H2.4z" stroke={color} strokeWidth={1.2} strokeLinejoin="round" />
      <Path d="M10.6 6.2l3 3.6M13.6 6.2l-3 3.6" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
    </Svg>
  );
}

/** 뒤로 — 왼쪽 꺾쇠 */
export function BackIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M12.5 4.5 7 10l5.5 5.5" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
