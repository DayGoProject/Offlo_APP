/**
 * 하단 탭 아이콘 — 웹 사이드바(Paper 앱 01)의 16 뷰박스 · 세선 아이콘을 그대로 옮겼다.
 * "더보기"만 웹에 없어 같은 선 굵기로 점 세 개를 그렸다. 색은 탭바가 준다 (활성 = 브랜드 그린).
 */
import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

type IconProps = { color: ColorValue; size?: number };

export function HomeIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Rect x={1.6} y={1.6} width={5.2} height={5.2} rx={1.2} stroke={color} strokeWidth={1.3} />
      <Rect x={9.2} y={1.6} width={5.2} height={5.2} rx={1.2} stroke={color} strokeWidth={1.3} />
      <Rect x={1.6} y={9.2} width={5.2} height={5.2} rx={1.2} stroke={color} strokeWidth={1.3} />
      <Rect x={9.2} y={9.2} width={5.2} height={5.2} rx={1.2} stroke={color} strokeWidth={1.3} />
    </Svg>
  );
}

export function AnalysisIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M2 12.4V7M6 12.4V3.6M10 12.4V9M14 12.4V5.4" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

export function GardenIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M8 14V6.4" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      <Path d="M7.7 7.4C6 7.2 4.3 6 3.7 4.1 5.6 3.6 7.3 4.8 7.7 7.4z" stroke={color} strokeWidth={1.2} />
      <Path d="M8.3 6.2c1.7-.2 3.4-1.5 4-3.4-1.9-.5-3.6.8-4 3.4z" stroke={color} strokeWidth={1.2} />
    </Svg>
  );
}

export function CommunityIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Circle cx={6} cy={5.6} r={2.6} stroke={color} strokeWidth={1.3} />
      <Path d="M1.8 13.2c0-2.4 1.9-4.2 4.2-4.2s4.2 1.8 4.2 4.2" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
      <Path d="M11 3.4a2.4 2.4 0 0 1 0 4.6M12.4 12.6c0-1.6-.6-3-1.6-3.9" stroke={color} strokeWidth={1.3} strokeLinecap="round" />
    </Svg>
  );
}

export function MoreIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Circle cx={3} cy={8} r={1.25} fill={color} />
      <Circle cx={8} cy={8} r={1.25} fill={color} />
      <Circle cx={13} cy={8} r={1.25} fill={color} />
    </Svg>
  );
}

/** AI 한마디 앞의 별 — 웹 대시보드와 같은 모양 */
export function SparkIcon({ color, size = 14 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Path d="M7 1.2l1.7 3.6 3.9.5-2.9 2.7.8 3.9L7 10l-3.5 1.9.8-3.9L1.4 5.3l3.9-.5L7 1.2z" fill={color} opacity={0.85} />
    </Svg>
  );
}
