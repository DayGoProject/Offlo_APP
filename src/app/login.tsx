/**
 * 로그인 — Google 단독 (M2). Apple 로그인은 M8에서 이 화면에 붙는다.
 *
 * 이메일 로그인·회원가입은 만들지 않는다 (소셜 전용 · security.md).
 * 미가입 계정은 막는다 — 가입은 Offlo 웹에서 한다.
 */
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/auth-context";
import GoogleIcon from "@/components/GoogleIcon";
import { AuthFlowError, getAuthErrorMessage } from "@/services/auth-errors";
import { ApiError } from "@/services/api";
import { BASE, fonts, WHITE } from "@/theme";
import { useTheme } from "@/theme-context";

export default function LoginScreen() {
  const { colors: c } = useTheme();
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
      // 예상한 안내(미가입·설정 누락·서버 메시지)는 로그로 남기지 않는다
      if (!(e instanceof AuthFlowError) && !(e instanceof ApiError)) {
        console.warn("[Google 로그인 실패]", e);
      }
      setError(getAuthErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View
      testID="login-screen"
      style={[
        styles.screen,
        { backgroundColor: c.bgPage, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.body}>
        <Text style={[styles.brandMark, { color: c.brand }]}>Offlo</Text>
        <Text style={[styles.title, { color: c.textPrimary }]}>로그인</Text>
        <Text style={[styles.subtitle, { color: c.textSecondary }]}>계속하려면 로그인해주세요</Text>

        <Pressable
          testID="google-login-button"
          accessibilityRole="button"
          accessibilityState={{ disabled: loading, busy: loading }}
          disabled={loading}
          onPress={handleGoogleLogin}
          style={({ pressed }) => [
            styles.googleButton,
            { borderColor: c.borderStrong, opacity: loading ? 0.6 : pressed ? 0.85 : 1 },
          ]}
        >
          {loading ? <ActivityIndicator color={BASE} /> : <GoogleIcon />}
          <Text style={styles.googleLabel}>{loading ? "로그인 중..." : "Google로 계속하기"}</Text>
        </Pressable>

        {error ? (
          <View
            testID="login-error"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={[styles.errorBox, { backgroundColor: c.dangerSoft, borderColor: c.dangerLine }]}
          >
            <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.footnote, { color: c.textFaint }]}>
        처음이신가요? Offlo 웹에서 Google로 가입한 뒤 로그인해주세요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
  },
  body: {
    flex: 1,
    justifyContent: "center",
    gap: 12,
  },
  brandMark: {
    fontFamily: fonts.bold,
    fontSize: 32,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 26,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    marginBottom: 20,
  },
  googleButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: WHITE,
  },
  googleLabel: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: BASE,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  footnote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
