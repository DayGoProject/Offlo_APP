/**
 * 3D 캔버스 안에서 던져진 에러(GL 컨텍스트 · 모델 로드 · 셰이더)를 붙잡는다 — 화면 전체가 죽지 않게.
 * 정원은 `fallback`이 비어 있어 SVG 리그가 대신 그려지고, 확인용 뷰어는 메시지를 띄운다.
 */
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** 에러가 났을 때 그릴 것 — 메시지를 받는다 */
  fallback?: (message: string) => ReactNode;
  onError?: (message: string) => void;
}

export default class PetErrorBoundary extends Component<Props, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  componentDidCatch(e: unknown) {
    this.props.onError?.(e instanceof Error ? e.message : String(e));
  }

  render() {
    if (this.state.error === null) return this.props.children;
    return this.props.fallback ? this.props.fallback(this.state.error) : null;
  }
}
