/**
 * 밥그릇 — 비었는지(배고픔의 신호) 가득 찼는지(오늘 밥을 먹었다)를 그림으로 보여 준다.
 * "밥 = 오늘의 분석"이라 그릇 상태는 동물 상태와 같이 간다: 배부름이면 가득, 그 밖엔 텅 빔.
 */
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Stop } from "react-native-svg";

import { useGradId } from "./Layer";
import { props as P } from "./palette";

const KIBBLE: readonly [number, number][] = [
  [26, 12.5],
  [33, 9.5],
  [41, 8],
  [49, 9.5],
  [55, 12.5],
  [30, 14.5],
  [38, 12],
  [46, 12.5],
  [52, 15],
  [36, 15.5],
  [44, 15.5],
];

export default function Bowl({ width, full }: { width: number; full: boolean }) {
  const grad = useGradId("bowl");
  return (
    <Svg width={width} height={(width * 44) / 80} viewBox="0 0 80 44" accessibilityLabel={full ? "가득 찬 밥그릇" : "빈 밥그릇"}>
      <Defs>
        <LinearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={P.bowlLight} />
          <Stop offset="1" stopColor={P.bowlShade} />
        </LinearGradient>
      </Defs>
      <Ellipse cx={40} cy={40} rx={34} ry={4} fill={P.shadow} />
      <Path d="M5 15 Q9 40 40 40 Q71 40 75 15 Z" fill={`url(#${grad})`} />
      <Ellipse cx={40} cy={15} rx={35} ry={9.5} fill={P.bowlLight} />
      <Ellipse cx={40} cy={16} rx={29} ry={6.8} fill={P.bowlInside} />
      {full ? (
        <>
          <Path d="M17 16 Q22 4 40 3.5 Q58 4 63 16 Q40 22 17 16 Z" fill={P.kibble} />
          {KIBBLE.map(([cx, cy], i) => (
            <Circle key={i} cx={cx} cy={cy} r={2.6} fill={i % 2 ? P.kibbleLight : P.kibble} />
          ))}
        </>
      ) : (
        <Ellipse cx={40} cy={17} rx={17} ry={3.2} fill="rgba(255,255,255,0.05)" />
      )}
      <Path d="M12 20 Q16 34 30 38" stroke="rgba(255,255,255,0.22)" strokeWidth={2} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
