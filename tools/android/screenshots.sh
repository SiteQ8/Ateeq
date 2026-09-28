#!/bin/sh
# Takes the Play screenshots on an emulator, from the same prepared scenes as the web and
# iPhone screenshots. Runs inside the emulator step of android.yml. Each scene is retried if
# the app is not the app in front when the picture is taken, and the phone's system log is
# kept with the pictures so a crash leaves its reason behind.
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
(adb logcat -v time > shots/logcat.txt 2>&1 &)

in_front() {
  { adb shell dumpsys activity activities 2>/dev/null; adb shell dumpsys window 2>/dev/null; } \
    | grep -E "topResumedActivity|mResumedActivity|mCurrentFocus|mFocusedApp" | grep -q "$PKG"
}

node tools/ios/scenes.mjs hajj-home,arafah,tawaf,sai,duas,trusts,look,home > shots/scenes.txt
while IFS='|' read -r name lang route state; do
  r=$(printf '%s' "$route" | sed 's/^#//')
  for attempt in 1 2 3; do
    adb shell am start -S -W -n "$PKG/.MainActivity" --es state "$state" --es route "'$r'" < /dev/null > /dev/null || true
    sleep 7
    if in_front; then
      adb exec-out screencap -p > "shots/$lang-$name.png" < /dev/null
      break
    fi
    echo "::warning::$lang-$name: the app was not in front, attempt $attempt"
    adb wait-for-device < /dev/null
  done
done < shots/scenes.txt
rm -f shots/scenes.txt

# The welcome, as a person sees it on opening the app. It never fails the run.
set +e
adb shell pm clear "$PKG" > /dev/null
adb shell am start -W -n "$PKG/.MainActivity" < /dev/null > /dev/null
sleep 2
adb exec-out screencap -p > shots/welcome-1.png < /dev/null
sleep 4
adb exec-out screencap -p > shots/welcome-2.png < /dev/null
ls -la shots
