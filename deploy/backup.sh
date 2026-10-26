#!/bin/sh
# Daily database backup to S3 (run by the smartverify-backup systemd timer).
# The bucket deletes backups older than 14 days by itself (lifecycle rule).
set -eu
BUCKET="$(cat /opt/smartverify/backup-bucket)"
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
FILE="/tmp/smartverify-$STAMP.sql.gz"
trap 'rm -f "$FILE"' EXIT

docker exec smartverify-db-1 pg_dump -U smartverify -d smartverify --no-owner | gzip -9 > "$FILE"
# An almost empty file means the dump failed: do not upload it as if it were a backup.
[ "$(stat -c %s "$FILE")" -gt 1000 ] || { echo "backup too small, not uploaded" >&2; exit 1; }
aws s3 cp "$FILE" "s3://$BUCKET/daily/smartverify-$STAMP.sql.gz" --only-show-errors
echo "backup uploaded: daily/smartverify-$STAMP.sql.gz"
