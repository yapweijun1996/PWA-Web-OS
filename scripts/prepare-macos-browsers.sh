#!/usr/bin/env bash
set -euo pipefail

destination=$1
mkdir "$destination"
destination=$(cd "$destination" && pwd -P)
working="$destination/downloads"
mkdir "$working"

install_browser() (
  local app="$1" identifier="$2" team="$3" url="$4"
  local image="$working/$identifier.dmg" mountpoint="$working/$identifier"
  local requirement="=identifier \"$identifier\" and anchor apple generic and certificate leaf[subject.OU] = \"$team\""
  mkdir "$mountpoint"
  curl --fail --silent --show-error --location --retry 2 --proto '=https' "$url" --output "$image"
  hdiutil attach -quiet -readonly -nobrowse -mountpoint "$mountpoint" "$image"
  trap 'hdiutil detach -quiet "$mountpoint"' EXIT
  ditto --norsrc --noextattr --noacl "$mountpoint/$app.app" "$destination/$app.app"
  codesign --verify --strict -R "$requirement" \
    "$destination/$app.app"
)

install_browser 'Google Chrome' 'com.google.Chrome' 'EQHXZ8M8AV' \
  'https://dl.google.com/chrome/mac/universal/stable/GGRO/googlechrome.dmg'
install_browser 'Firefox' 'org.mozilla.firefox' '43AQ936H96' \
  'https://download.mozilla.org/?product=firefox-latest-ssl&os=osx&lang=en-US'
chrome_version=$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$destination/Google Chrome.app/Contents/Info.plist")
firefox_version=$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$destination/Firefox.app/Contents/Info.plist")
printf 'Google Chrome %s\nMozilla Firefox %s\n' "$chrome_version" "$firefox_version"

case "$(uname -m)" in
  arm64) platform='mac-arm64' ;;
  x86_64) platform='mac-x64' ;;
  *) exit 1 ;;
esac
driver_url=$(curl --fail --silent --show-error --location --retry 2 --proto '=https' \
  'https://googlechromelabs.github.io/chrome-for-testing/latest-patch-versions-per-build-with-downloads.json' |
  jq -er --arg build "${chrome_version%.*}" --arg platform "$platform" \
    '.builds[$build].downloads.chromedriver[] | select(.platform == $platform).url | select(startswith("https://storage.googleapis.com/chrome-for-testing-public/"))')
curl --fail --silent --show-error --location --retry 2 --proto '=https' "$driver_url" --output "$working/chromedriver.zip"
unzip -joq "$working/chromedriver.zip" '*/chromedriver' -d "$destination"
"$destination/chromedriver" --version
