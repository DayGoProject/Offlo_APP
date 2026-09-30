/**
 * 3D 클레이 동물 확인용 뷰어 — `PetCanvas`(네이티브 · 웹 짝 파일)를 에러 메시지와 함께 그린다. `/preview/clay`가 쓴다.
 * 동물을 직접 탭해도 쓰다듬는다 (`interactive`).
 */
import { Text, View } from "react-native";

import PetErrorBoundary from "./PetErrorBoundary";
import PetCanvas from "./PetCanvas";
import type { PetCanvasProps } from "./petCanvasTypes";

export type ClayPetProps = Omit<PetCanvasProps, "layout" | "active" | "onReady" | "interactive">;

export default function ClayPetView(props: ClayPetProps) {
  return (
    <PetErrorBoundary
      fallback={(message) => (
        <View style={{ padding: 12 }}>
          <Text testID="clay-error" style={{ color: "#FF5656", fontSize: 12 }}>
            {message.slice(0, 400)}
          </Text>
        </View>
      )}
    >
      <PetCanvas {...props} interactive />
    </PetErrorBoundary>
  );
}
