#!/usr/bin/env bash
# LG webOS TV: pair, then install the web build or a live dev app.
#   scripts/tv/lg.sh setup <TV_IP>   pair (Developer Mode app open on the TV); also after an IP change
#   scripts/tv/lg.sh install         build, package, install and launch com.tvphotogallery
#   scripts/tv/lg.sh dev             thin app that loads `npm run web:tv` from this laptop
#   scripts/tv/lg.sh inspect [dev]   DevTools for the installed app
#   scripts/tv/lg.sh info | list     TV details | installed apps
# LG_TV picks the saved TV name (default MyLGTV).
set -euo pipefail

cd "$(dirname "$0")/../.."
TV=${LG_TV:-MyLGTV}
APP_ID=com.tvphotogallery
DEV_ID=$APP_ID.dev
OUT=build/webos
VERSION=$(node -p "require('./package.json').version")

say() { printf '\033[1m%s\033[0m\n' "$*"; }
die() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }
usage() { sed -n '2,8p' "$0"; exit "${1:-0}"; }

command -v ares-setup-device >/dev/null ||
  die "LG tools missing: npm install -g @webos-tools/cli"

saved() { ares-setup-device --list 2>/dev/null | awk -v n="$TV" '$1 == n' | grep -q .; }

tv_ip() {
  ares-setup-device --listfull 2>/dev/null | node -e '
    const list = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const tv = list.find(d => d.name === process.argv[1]);
    if (tv) console.log(tv.deviceinfo.ip);' "$TV"
}

# The laptop address the TV can reach (the one on the route to it)
laptop_ip() {
  local tv
  tv=$(tv_ip)
  [[ -n $tv ]] || die "$TV is not saved: run setup first"
  if command -v ip >/dev/null; then
    ip route get "$tv" | awk '{ for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1) }'
  else
    ipconfig getifaddr "$(route -n get "$tv" | awk '/interface:/ { print $2 }')"
  fi
}

# appinfo.json + icon into <dir>; <id> <title> <main>
app_files() {
  local dir=$1 id=$2 title=$3 main=$4
  mkdir -p "$dir"
  cp assets/brand/app-icon.png "$dir/icon.png"
  cat >"$dir/appinfo.json" <<EOF
{
  "id": "$id",
  "version": "$VERSION",
  "vendor": "TvPhotoGallery",
  "type": "web",
  "main": "$main",
  "title": "$title",
  "icon": "icon.png",
  "resolution": "1920x1080",
  "requiredACG": [],
  "disableBackHistoryAPI": true
}
EOF
}

package_install_launch() {
  local dir=$1 id=$2 ipk
  ares-package "$dir" -o "$OUT"
  ipk="$OUT/${id}_${VERSION}_all.ipk"
  [[ -f $ipk ]] || die "No package at $ipk"
  ares-install --device "$TV" "$ipk"
  ares-launch --device "$TV" "$id"
}

cmd=${1:-}
case $cmd in
  setup)
    ip=${2:-}
    [[ -n $ip ]] || die "Usage: scripts/tv/lg.sh setup <TV_IP>  (the IP shown in the Developer Mode app)"
    if saved; then
      ares-setup-device -m "$TV" -i "host=$ip"
    else
      # prisoner and 9922 are fixed: the TV's developer account and SSH port
      ares-setup-device -a "$TV" -i "username=prisoner" -i "host=$ip" -i "port=9922"
    fi
    ares-setup-device -f "$TV"
    say "Type the passphrase shown in the Developer Mode app (keep it open, Key Server ON):"
    NO_PROXY='*' no_proxy='*' ares-novacom --device "$TV" --getkey ||
      die "Pairing failed: same network as the TV? Toggle Key Server OFF/ON and run again."
    ares-device -i --device "$TV"
    say "Paired with $TV at $ip."
    ;;
  install)
    npm run build:web
    rm -rf "$OUT/app"
    mkdir -p "$OUT"
    cp -r web-build "$OUT/app"
    app_files "$OUT/app" "$APP_ID" "Photo Gallery" index.html
    package_install_launch "$OUT/app" "$APP_ID"
    say "Installed. DevTools: scripts/tv/lg.sh inspect"
    ;;
  dev)
    url="http://$(laptop_ip):8080/"
    curl -sf -o /dev/null "$url" ||
      die "No dev server at $url. In another terminal: npm run web:tv"
    rm -rf "$OUT/dev"
    app_files "$OUT/dev" "$DEV_ID" "Photo Gallery (dev)" index.html
    printf '<!doctype html><script>location.replace(%s)</script>\n' "'$url'" >"$OUT/dev/index.html"
    package_install_launch "$OUT/dev" "$DEV_ID"
    say "Dev app loads $url; edits reload on the TV. DevTools: scripts/tv/lg.sh inspect dev"
    ;;
  inspect)
    id=$APP_ID
    [[ ${2:-} == dev ]] && id=$DEV_ID
    ares-inspect --device "$TV" --app "$id" --open
    ;;
  info) ares-device -i --device "$TV" ;;
  list) ares-install --device "$TV" --list ;;
  -h | --help | "") usage ;;
  *) usage 1 ;;
esac
