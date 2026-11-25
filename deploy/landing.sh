#!/bin/sh
# Put the landing page (and optionally the Android app) on gebtual.com.et, the Tele Plesk hosting.
# Run from the repo root in Git Bash; it asks for the hosting password.
# Usage: sh deploy/landing.sh [path/to/app.apk]
# Only index.html, .htaccess and download/gebtual.apk are written; relay.php is left alone.
set -eu
TARGET="${LANDING_TARGET:-gebtualc@213.55.96.150}"
APK="${1:-}"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp landing/index.html landing/.htaccess "$STAGE/"
set -- "$STAGE/index.html" "$STAGE/.htaccess"
if [ -n "$APK" ]; then
  mkdir "$STAGE/download"
  cp "$APK" "$STAGE/download/gebtual.apk"
  set -- "$@" "$STAGE/download"
fi

scp -r "$@" "$TARGET:httpdocs/"
echo "uploaded. Check: curl -I https://gebtual.com.et/"
