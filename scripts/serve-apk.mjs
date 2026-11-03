/**
 * 같은 Wi-Fi의 폰이 APK를 내려받게 `.verify/apk-share/` 폴더만 임시로 내보낸다 (외부에 올리지 않는다).
 *
 *   node scripts/serve-apk.mjs            # 8099 포트 — Ctrl+C로 끄면 끝
 *   node scripts/expo-go-qr.mjs --apk     # 내려받기 QR 이미지 → .verify/apk-qr.png
 *
 * 이 폴더 밖의 파일은 절대 내보내지 않는다 (경로 탈출 차단). APK에는 앱 번들(공개 값만 든 EXPO_PUBLIC_*)이 들어 있다 — 테스트가 끝나면 서버를 끈다.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHARE = join(ROOT, ".verify", "apk-share");
const PORT = Number(process.env.PORT ?? 8099);

createServer((req, res) => {
  const name = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\/+/, "") || "offlo.apk";
  const file = resolve(SHARE, name);
  if (!file.startsWith(SHARE + sep) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("없는 파일입니다.");
    return;
  }
  const size = statSync(file).size;
  console.log(`${new Date().toLocaleTimeString("ko-KR")}  ${req.socket.remoteAddress}  GET /${name}  (${(size / 1048576).toFixed(1)}MB)`);
  res.writeHead(200, {
    "Content-Type": name.endsWith(".apk") ? "application/vnd.android.package-archive" : "application/octet-stream",
    "Content-Length": size,
    "Content-Disposition": `attachment; filename="${name}"`,
  });
  createReadStream(file).pipe(res);
}).listen(PORT, "0.0.0.0", () => console.log(`APK 서버: http://0.0.0.0:${PORT}/offlo.apk  (폴더 ${SHARE})`));
