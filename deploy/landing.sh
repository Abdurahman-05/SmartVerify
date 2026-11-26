#!/bin/sh
# Put the landing page (and optionally the Android app) on gebtual.com.et, the Tele Plesk hosting.
# Run from the repo root in Git Bash; it asks for the hosting password.
# Usage: sh deploy/landing.sh [path/to/app.apk]
# Only the landing/ files and download/gebtual.apk are written; relay.php is left alone.
set -eu
TARGET="${LANDING_TARGET:-gebtualc@213.55.96.150}"
APK="${1:-}"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
FILES="index.html .htaccess favicon.ico logo.png robots.txt sitemap.xml"
set --
for f in $FILES; do
  cp "landing/$f" "$STAGE/"
  set -- "$@" "$STAGE/$f"
done
if [ -n "$APK" ]; then
  mkdir "$STAGE/download"
  cp "$APK" "$STAGE/download/gebtual.apk"
  set -- "$@" "$STAGE/download"
fi

scp -r "$@" "$TARGET:httpdocs/"
echo "uploaded. Check: curl -I https://gebtual.com.et/"
