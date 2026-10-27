#!/usr/bin/env bash
# Renders every platform's icon PNGs from the SVGs in assets/brand.
# Re-run after changing them. Needs ImageMagick built with librsvg.
set -euo pipefail

cd "$(dirname "$0")/.."
BRAND=assets/brand
ANDROID_RES=android/app/src/main/res
IOS_ICONS=ios/TvPhotoGallery/Images.xcassets/AppIcon.appiconset

# render <svg> <width> <height> <out.png>
# The RSVG: prefix matters: ImageMagick's built-in renderer ignores masks
render() {
  magick -background none -density 1200 "RSVG:$1" \
    -resize "$2x$3!" -strip "PNG32:$4"
}

# Like render, then cut to a shape: rounded <corner radius as a fraction of
# the size>, or 0.5 for a circle
render_masked() {
  local svg=$1 size=$2 out=$3 corner=$4
  local radius
  radius=$(awk "BEGIN { print $size * $corner }")
  render "$svg" "$size" "$size" "$out"
  magick "$out" \
    \( -size "${size}x${size}" xc:none -fill white \
       -draw "roundrectangle 0,0 $((size - 1)),$((size - 1)) $radius,$radius" \) \
    -compose DstIn -composite -strip "PNG32:$out"
}

# The icon's glyph without its background, for the adaptive icon's
# foreground layer (the background layer is a drawable gradient)
FOREGROUND=$(mktemp --suffix=.svg)
trap 'rm -f "$FOREGROUND"' EXIT
sed '/fill="url(#background)"/d' "$BRAND/app-icon.svg" > "$FOREGROUND"

# --- In-app (Home header) ---------------------------------------------------
render_masked "$BRAND/app-icon.svg" 144 "$BRAND/app-icon.png" 0.2

# --- Android ----------------------------------------------------------------
# Launcher icons are 48dp; adaptive foregrounds are 108dp
for entry in mdpi:1 hdpi:1.5 xhdpi:2 xxhdpi:3 xxxhdpi:4; do
  density=${entry%%:*}
  scale=${entry##*:}
  dir="$ANDROID_RES/mipmap-$density"
  icon=$(awk "BEGIN { print int(48 * $scale) }")
  layer=$(awk "BEGIN { print int(108 * $scale) }")
  mkdir -p "$dir"
  render_masked "$BRAND/app-icon.svg" "$icon" "$dir/ic_launcher.png" 0.2
  render_masked "$BRAND/app-icon.svg" "$icon" "$dir/ic_launcher_round.png" 0.5
  render "$FOREGROUND" "$layer" "$layer" "$dir/ic_launcher_foreground.png"
done

# Android TV shows a 320x180 banner on its home screen, from xhdpi
mkdir -p "$ANDROID_RES/drawable-xhdpi"
render "$BRAND/banner.svg" 320 180 "$ANDROID_RES/drawable-xhdpi/banner.png"

# --- iOS --------------------------------------------------------------------
# The App Store rejects icons with transparency, and iOS rounds them itself
for size in 40 58 60 80 87 120 180 1024; do
  render "$BRAND/app-icon.svg" "$size" "$size" "$IOS_ICONS/icon-$size.png"
  magick "$IOS_ICONS/icon-$size.png" -alpha off -strip "PNG24:$IOS_ICONS/icon-$size.png"
done

# Web uses app-icon.svg as the favicon directly (webpack.config.js)

echo "Icons generated."
