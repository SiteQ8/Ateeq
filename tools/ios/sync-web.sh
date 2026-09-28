#!/bin/sh
# Copies the web app into ios/Web, the folder the iPhone app serves from inside its bundle.
# docs/ stays the single source: ios/Web is generated and ignored by git.
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
OUT="$ROOT/ios/Web"
rm -rf "$OUT"
mkdir -p "$OUT/assets"
cp -R "$ROOT/docs/app" "$OUT/app"
cp -R "$ROOT/docs/data" "$OUT/data"
cp -R "$ROOT/docs/fonts" "$OUT/fonts"
for f in logo.svg mark-flat.svg icon.svg icon-180.png; do
  cp "$ROOT/docs/assets/$f" "$OUT/assets/$f"
done
echo "web app copied to ios/Web"
