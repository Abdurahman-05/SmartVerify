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
echo "DB_PASSWORD=$(echo "$PARAMS" | awk -F'\t' '$1 == "/smartverify/DB_PASSWORD" { print $2 }')" > .env.compose
umask 022

# New code and admin website.
rm -rf app.new admin.new
mkdir -p app.new admin.new
aws s3 cp "s3://$BUCKET/release/code.tar.gz" - --only-show-errors | tar -xz -C app.new
aws s3 cp "s3://$BUCKET/release/admin.tar.gz" - --only-show-errors | tar -xz -C admin.new
rm -rf app.old admin.old
[ -d app ] && mv app app.old
mv app.new app
[ -d admin ] && mv admin admin.old
mv admin.new admin

cd app/deploy
docker compose --env-file /opt/smartverify/.env.compose up -d --build
docker image prune -f >/dev/null
echo "updated"
