#!/usr/bin/env bash
# 不用 Gradle 的本機建置：aapt → javac → dx → zipalign → apksigner（GitHub Actions 上是用 Gradle，結果相同）
# 需要：ANDROID_JAR=/path/android.jar，以及 aapt、dalvik-exchange、zipalign、apksigner（Ubuntu：apt install aapt dalvik-exchange zipalign apksigner）
# 簽章：KS=金鑰檔 KS_PASS=… KEY_ALIAS=… KEY_PASS=…
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${OUT:-$ROOT/build}"
VER="$(tr -d '[:space:]' < "$ROOT/VERSION")"
IFS=. read -r A B C <<< "$VER"
CODE=$((A * 10000 + B * 100 + C))
rm -rf "$OUT" && mkdir -p "$OUT/cls" "$OUT/gen"
python3 "$ROOT/web/build.py"
sed 's#<manifest xmlns:android="http://schemas.android.com/apk/res/android" *>#<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.ian.foodmap">#' "$ROOT/app/src/main/AndroidManifest.xml" > "$OUT/AndroidManifest.xml"
grep -q 'package="com.ian.foodmap"' "$OUT/AndroidManifest.xml"
aapt package -f -m -J "$OUT/gen" -M "$OUT/AndroidManifest.xml" -S "$ROOT/app/src/main/res" -A "$ROOT/app/src/main/assets" -I "$ANDROID_JAR" \
  -F "$OUT/unsigned.apk" --min-sdk-version 26 --target-sdk-version 34 --version-code "$CODE" --version-name "$VER"
javac -nowarn -source 8 -target 8 -encoding UTF-8 -bootclasspath "$ANDROID_JAR" -d "$OUT/cls" \
  $(find "$ROOT/app/src/main/java" "$OUT/gen" -name '*.java') 2>&1 | grep -v -E '^(warning|Note|Picked up)|bootstrap|^[0-9]+ warnings?$' || true
dalvik-exchange --dex --min-sdk-version=26 --output="$OUT/classes.dex" "$OUT/cls" 2>&1 | grep -v 'Picked up' || true
test -s "$OUT/classes.dex"
(cd "$OUT" && aapt add unsigned.apk classes.dex > /dev/null)
zipalign -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
apksigner sign --ks "$KS" --ks-pass "pass:$KS_PASS" --ks-key-alias "$KEY_ALIAS" --key-pass "pass:$KEY_PASS" \
  --min-sdk-version 26 --v4-signing-enabled false --out "$OUT/signed.apk" "$OUT/aligned.apk" 2>&1 | grep -v 'Picked up' || true
apksigner verify --verbose "$OUT/signed.apk" 2>&1 | grep -E 'Verified using v[23]|ERROR' | head -3
cp "$OUT/signed.apk" "$OUT/食光地圖_v${VER}.apk"
ls -la "$OUT" | grep apk
