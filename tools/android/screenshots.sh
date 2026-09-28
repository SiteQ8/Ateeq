#!/bin/sh
# Takes the Play screenshots on an emulator, from the same prepared scenes as the web and
# iPhone screenshots. Runs inside the emulator step of android.yml. Every picture is taken
# only once the app is the focused window, and checked again after, so a slow start can
# never leave the phone's home screen in a store picture.
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

in_front() {
  adb shell dumpsys window 2>/dev/null | grep -E "mCurrentFocus|mFocusedApp" | grep -q "$PKG"
}
open_scene() {
  adb shell am start -S -W -n "$PKG/.MainActivity" --es state "$1" --es route "'$2'" < /dev/null > /dev/null
  n=0
  until in_front; do
    n=$((n + 1)); [ $n -gt 30 ] && return 1
    sleep 1
  done
  sleep 6
}

mkdir -p shots
# The phone's system log goes to a file for the whole run, so a crash leaves its reason behind.
(adb logcat -v time > shots/logcat.txt 2>&1 &)
node tools/ios/scenes.mjs hajj-home,arafah,tawaf,sai,duas,trusts,look,home > shots/scenes.txt

# If the phone restarts, wait for it to finish booting before carrying on.
recover() {
  adb wait-for-device
  until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done
  (adb logcat -v time >> shots/logcat.txt 2>&1 &)
  sleep 10
}

# The first start after installing warms up WebView, which is slow on an emulator.
first=$(head -1 shots/scenes.txt | cut -d'|' -f4)
adb shell am start -W -n "$PKG/.MainActivity" --es state "$first" < /dev/null > /dev/null
sleep 15
while IFS='|' read -r name lang route state; do
  r=$(printf '%s' "$route" | sed 's/^#//')
  for attempt in 1 2 3; do
    if open_scene "$state" "$r"; then
      adb exec-out screencap -p > "shots/$lang-$name.png" < /dev/null
      if in_front; then break; fi
    fi
    echo "retrying $lang-$name"
    adb get-state > /dev/null 2>&1 || { echo "the phone went away, waiting for it"; recover; }
  done
  in_front || { echo "the app never came to the front for $lang-$name"; exit 1; }
done < shots/scenes.txt
rm -f shots/scenes.txt

# The welcome, as a person sees it on opening the app. It never fails the run: it is here to
# look at, and to show whether the phone copes with its animation.
set +e
adb shell pm clear "$PKG" > /dev/null
adb shell am start -W -n "$PKG/.MainActivity" < /dev/null > /dev/null
sleep 2
adb exec-out screencap -p > shots/welcome-1.png < /dev/null
sleep 4
adb exec-out screencap -p > shots/welcome-2.png < /dev/null
adb get-state && echo "the emulator is still up after the welcome"
ls -la shots
