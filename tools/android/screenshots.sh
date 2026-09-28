#!/bin/sh
# Takes the Play screenshots on an emulator, from the same prepared scenes as the web and
# iPhone screenshots. Runs inside the emulator step of android.yml.
set -e
APK=android/app/build/outputs/apk/release/app-release.apk
PKG=com.eworldq8.ateeq
adb install -r "$APK"
adb shell settings put global sysui_demo_allowed 1
adb shell am broadcast -a com.android.systemui.demo -e command enter
adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 0941
adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false
adb shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4 -e mobile hide
adb shell am broadcast -a com.android.systemui.demo -e command notifications -e visible false
mkdir -p shots
node tools/ios/scenes.mjs hajj-home,arafah,tawaf,sai,duas,trusts,look,home > shots/scenes.txt
while IFS='|' read -r name lang route state; do
  r=$(printf '%s' "$route" | sed 's/^#//')
  adb shell am start -S -W -n "$PKG/.MainActivity" --es state "$state" --es route "'$r'" < /dev/null > /dev/null
  sleep 6
  adb exec-out screencap -p > "shots/$lang-$name.png" < /dev/null
done < shots/scenes.txt
rm -f shots/scenes.txt
ls -la shots
