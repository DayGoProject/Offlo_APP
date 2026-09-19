/**
 * 사진 고르기 · 분석용 압축 — 웹 `services/image.ts`(canvas) 대응.
 *
 * - 고르기: 시스템 사진 선택기(`expo-image-picker`). 안드로이드 13+ · iOS 14+ 선택기는 앱에 사진 전체 권한을 주지 않는다.
 *   카메라는 쓰지 않는다 — 휴대폰으로 자기 휴대폰 화면을 찍을 수 없어 스크린타임 용도엔 쓸모가 없다 (app.json에서 권한도 뺐다)
 * - 압축: `expo-image-manipulator`로 장변 1600px 축소 → JPEG. 상한을 넘으면 품질을 낮춰 **같은 렌더 결과를 다시 저장**한다
 *   (웹 루프와 같은 단계 — logic/image.ts). HEIC도 기기가 디코딩해 JPEG로 바뀐다 (웹은 브라우저가 못 읽어 막았다)
 *
 * 이미지는 어디에도 저장하지 않는다 — base64를 요청 본문에 실어 보내고 버린다. 캐시 폴더의 임시 JPEG는 OS가 정리한다.
 */
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { cleanBase64, fitWithin, IMAGE_MESSAGES, MAX_BASE64_LENGTH, qualitySteps } from "@/logic/image";

export interface InlineImage {
  imageBase64: string;
  mimeType: "image/jpeg";
}

/** 화면에 한국어 한 줄로 띄울 수 있는 실패 */
export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageError";
  }
}

/** 사진 한 장을 고른다. 취소하면 null (기기 안의 주소만 돌려준다 — 읽기는 보낼 때 한 번) */
export async function pickImage(): Promise<string | null> {
  let result: ImagePicker.ImagePickerResult;
  try {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      allowsMultipleSelection: false,
      quality: 1,
      exif: false,
    });
  } catch {
    throw new ImageError(IMAGE_MESSAGES.pickerFailed);
  }
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

/** 기기 안의 이미지를 분석 요청에 실을 base64 JPEG로 만든다 */
export async function toInlineImage(uri: string): Promise<InlineImage> {
  let image;
  try {
    image = await ImageManipulator.manipulate(uri).renderAsync();
    const target = fitWithin(image.width, image.height);
    if (target) image = await ImageManipulator.manipulate(uri).resize(target).renderAsync();
  } catch {
    throw new ImageError(IMAGE_MESSAGES.unreadable);
  }

  for (const compress of qualitySteps()) {
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
    const base64 = cleanBase64(saved.base64 ?? "");
    if (base64 && base64.length <= MAX_BASE64_LENGTH) return { imageBase64: base64, mimeType: "image/jpeg" };
  }
  throw new ImageError(IMAGE_MESSAGES.tooLarge);
}

/** 사진 · 압축 실패는 그 문구를, 나머지는 기본 문구를 */
export function getImageErrorMessage(err: unknown): string {
  return err instanceof ImageError ? err.message : IMAGE_MESSAGES.unreadable;
}
