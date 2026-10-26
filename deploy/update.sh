#!/bin/sh
# Put a new version live (run as root on the server through SSM Run Command).
# Usage: update.sh <s3 bucket>   — takes code.tar.gz and admin.tar.gz from s3://<bucket>/release/
set -eu
BUCKET="$1"
cd /opt/smartverify

# Secrets: from SSM Parameter Store (encrypted), written for Docker only, readable by root only.
umask 077
PARAMS="$(aws ssm get-parameters-by-path --path /smartverify/ --with-decryption \
  --query 'Parameters[].[Name,Value]' --output text)"
echo "$PARAMS" | awk -F'\t' '$1 != "/smartverify/DB_PASSWORD" { sub("/smartverify/", "", $1); print $1 "=" $2 }' > api.env
DB_PASSWORD="$(echo "$PARAMS" | awk -F'\t' '$1 == "/smartverify/DB_PASSWORD" { print $2 }')"
# The site address is the admin's web origin without https:// (e.g. 51-21-74-119.sslip.io).
SITE_ADDRESS="$(echo "$PARAMS" | awk -F'\t' '$1 == "/smartverify/WEB_ORIGINS" { print $2 }' | sed 's#^https://##; s#,.*##')"
printf 'DB_PASSWORD=%s\nSITE_ADDRESS=%s\n' "$DB_PASSWORD" "$SITE_ADDRESS" > .env.compose
umask 022

# New code.
rm -rf app.new && mkdir app.new
aws s3 cp "s3://$BUCKET/release/code.tar.gz" - --only-show-errors | tar -xz -C app.new
rm -rf app.old
[ -d app ] && mv app app.old
mv app.new app

# New admin website: replaced in place (the web container keeps pointing at this folder).
rm -rf admin.new && mkdir admin.new
aws s3 cp "s3://$BUCKET/release/admin.tar.gz" - --only-show-errors | tar -xz -C admin.new
mkdir -p admin
find admin -mindepth 1 -delete
cp -a admin.new/. admin/
rm -rf admin.new

cd app/deploy
docker compose --env-file /opt/smartverify/.env.compose up -d --build
docker image prune -f >/dev/null
echo "updated"
