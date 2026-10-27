/**
 * 로그인 — Google 단독. **로그인이 곧 가입이다** — 처음 로그인하는 Google 계정은 그 자리에서 계정이 만들어진다 (M9 결정 · `auth-context.tsx`).
 * 이메일 로그인·회원가입은 만들지 않는다 (소셜 전용 · security.md). 개인정보 처리방침 링크를 둔다 (스토어 요구).
 */
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/auth-context";
import GoogleIcon from "@/components/GoogleIcon";
import { PRIVACY_URL } from "@/config";
import { ApiError } from "@/services/api";
import { AuthFlowError, getAuthErrorMessage } from "@/services/auth-errors";
import { colors, em, fonts, radius, VOID, WHITE } from "@/theme";

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    setError("");
    setLoading(true);
    try {
      // 성공하면 라우트 가드가 홈으로 넘긴다 — 여기서 이동하지 않는다
      await signInWithGoogle();
    } catch (e) {
      // 예상한 안내(설정 누락·서버 메시지)는 로그로 남기지 않는다
      if (!(e instanceof AuthFlowError) && !(e instanceof ApiError)) {
        console.warn("[Google 로그인 실패]", e);
      }
      setError(getAuthErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View testID="login-screen" style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.body}>
        <Text style={styles.brandMark}>Offlo</Text>
        <Text accessibilityRole="header" style={styles.title}>
          로그인
        </Text>
        <Text style={styles.subtitle}>Google 계정으로 바로 시작해요. 처음이면 계정이 만들어져요.</Text>

        <Pressable
          testID="google-login-button"
          accessibilityRole="button"
          accessibilityState={{ disabled: loading, busy: loading }}
          disabled={loading}
          onPress={handleGoogleLogin}
          style={({ pressed }) => [styles.googleButton, { opacity: loading ? 0.6 : pressed ? 0.9 : 1 }]}
        >
          {loading ? <ActivityIndicator color={VOID} /> : <GoogleIcon />}
          <Text style={styles.googleLabel}>{loading ? "로그인 중..." : "Google로 계속하기"}</Text>
        </Pressable>

        {error ? (
          <View testID="login-error" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.footnote}>
        계속하면{" "}
        <Text
          testID="privacy-link"
          accessibilityRole="link"
          onPress={() => void Linking.openURL(PRIVACY_URL).catch(() => {})}
          style={styles.footLink}
        >
          개인정보 처리방침
        </Text>
        을 읽고 동의한 것으로 봐요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: colors.bgPage,
  },
  body: {
    flex: 1,
    justifyContent: "center",
    gap: 12,
  },
  brandMark: {
    marginBottom: 12,
    fontFamily: fonts.num,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: em(34, -0.04),
    color: colors.brand,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: em(26, -0.035),
    color: colors.textPrimary,
  },
  subtitle: {
    marginBottom: 20,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
  },
  googleButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: radius.pill,
    backgroundColor: WHITE,
  },
  googleLabel: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: VOID,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerLine,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },
  footnote: {
    textAlign: "center",
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textFaint,
  },
  footLink: {
    color: colors.textSecondary,
    textDecorationLine: "underline",
  },
});
