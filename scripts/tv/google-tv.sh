#!/usr/bin/env bash
# Connects adb to a Google TV / Android TV over Wi-Fi, then optionally runs the app.
#   scripts/tv/google-tv.sh [TV_IP] [--run | --release]
# Without TV_IP the TV is found with `adb mdns services` (wake it first).
# --run installs the debug build (JS from Metro); --release a release build, no Metro.
set -euo pipefail

cd "$(dirname "$0")/../.."
IP=""
RUN=false
RELEASE=false
for arg in "$@"; do
  case $arg in
    --run) RUN=true ;;
    --release) RELEASE=true ;;
    -h | --help) sed -n '2,5p' "$0"; exit 0 ;;
    *) IP=${arg%:5555} ;;
  esac
done

say() { printf '\033[1m%s\033[0m\n' "$*"; }
die() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

command -v adb >/dev/null || die "adb not found: install Android platform-tools"

# Every Google TV keeps the Cast port (8009) open: tells the TV from a laptop
# or phone that picked up its old address
is_tv() {
  if command -v nc >/dev/null; then
    nc -z -w 3 "$1" 8009 2>/dev/null
  else
    timeout 3 bash -c "</dev/tcp/$1/8009" 2>/dev/null
  fi
}

if [[ -z $IP ]]; then
  say "Looking for the TV (press a remote button if it sleeps)..."
  # The first call starts adb and often returns before it has looked
  for try in 1 2 3 4; do
    mapfile -t FOUND < <(adb mdns services 2>/dev/null |
      awk '$2 ~ /^_adb\._tcp/ { split($3, a, ":"); print a[1] }' | sort -u)
    ((${#FOUND[@]})) && break
    [[ $try -lt 4 ]] && sleep 5
  done
  ((${#FOUND[@]})) ||
    die "No TV found. Wake it, check USB debugging is ON and you share its Wi-Fi, or pass its IP."
  for candidate in "${FOUND[@]}"; do
    if is_tv "$candidate"; then IP=$candidate; break; fi
  done
  [[ -n $IP ]] || die "Found ${FOUND[*]} but none answers on the Cast port 8009."
else
  is_tv "$IP" || die "$IP does not answer on port 8009: not a Google TV, or asleep."
fi

SERIAL="$IP:5555"
say "TV at $IP"

state() { adb devices | awk -v s="$SERIAL" '$1 == s { print $2 }'; }

connect_out=$(adb connect "$SERIAL" 2>&1 || true)
echo "$connect_out"
case $connect_out in
  *refused*) die "Connection refused: that IP belongs to another device now. Run again without an IP." ;;
  *"timed out"*) die "Timed out: the TV is asleep. Press a remote button and try again." ;;
esac

# The first connection asks on the TV screen: tick "Always allow", press OK
for _ in $(seq 1 30); do
  case $(state) in
    device) break ;;
    unauthorized) say "Accept the prompt on the TV (tick Always allow, press OK)..." ;;
    offline) adb disconnect "$SERIAL" >/dev/null; adb connect "$SERIAL" >/dev/null ;;
    *) adb connect "$SERIAL" >/dev/null 2>&1 || true ;;
  esac
  sleep 2
done
[[ $(state) == device ]] || die "The TV is still '$(state)'. Run again."

adb devices -l | grep -F "$SERIAL"
# Lost on every disconnect: lets the TV reach Metro on this laptop
adb -s "$SERIAL" reverse tcp:8081 tcp:8081 >/dev/null
say "Connected. Metro port 8081 reversed."

if $RELEASE; then
  # Only the TV's own ABI: the Google TV Streamer is 32-bit (armeabi-v7a)
  ABI=$(adb -s "$SERIAL" shell getprop ro.product.cpu.abi | tr -d '\r')
  [[ -n $ABI ]] || die "Could not read the TV's ABI: it dropped off adb. Run again."
  say "Building the release APK for $ABI..."
  (cd android && ./gradlew assembleRelease -PreactNativeArchitectures="$ABI")
  # Signed with the debug key, so it replaces the debug app in place
  adb -s "$SERIAL" install -r android/app/build/outputs/apk/release/app-release.apk
  adb -s "$SERIAL" shell am start -n com.tvphotogallery/.MainActivity >/dev/null
  say "Release build installed and launched."
elif $RUN; then
  ANDROID_SERIAL=$SERIAL npm run android
else
  echo
  echo "Next, in this terminal:"
  echo "  export ANDROID_SERIAL=$SERIAL"
  echo "  npm run android      # builds, installs over Wi-Fi, launches (Metro opens if not running)"
  echo "Or run this script with --release for a release build (fast; what the TV should be judged on)."
  echo "Logs: adb -s $SERIAL logcat -s ReactNativeJS | grep -E '\\[(app|report)\\]'"
fi
