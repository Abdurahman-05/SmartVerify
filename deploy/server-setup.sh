#!/bin/sh
# One-time setup of a new server (Amazon Linux 2023). Run as root (through SSM Run Command).
# Safe to run again: every step checks first.
set -eu

# Docker + the compose plugin.
if ! command -v docker >/dev/null 2>&1; then
  dnf install -y docker
  systemctl enable --now docker
fi
if ! docker compose version >/dev/null 2>&1; then
  ARCH="$(uname -m)"
  mkdir -p /usr/local/lib/docker/cli-plugins
  curl -fsSL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-$ARCH" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

# The database lives on its own disk (/dev/sdf → shows as an NVMe device), mounted at /data.
if ! mountpoint -q /data; then
  DISK=""
  for d in /dev/nvme1n1 /dev/xvdf /dev/sdf; do [ -b "$d" ] && DISK="$d" && break; done
  [ -n "$DISK" ] || { echo "data disk not found" >&2; exit 1; }
  # Format only an empty disk (never one that already holds data).
  blkid "$DISK" >/dev/null 2>&1 || mkfs -t xfs "$DISK"
  mkdir -p /data
  UUID="$(blkid -s UUID -o value "$DISK")"
  grep -q "$UUID" /etc/fstab || echo "UUID=$UUID /data xfs defaults,nofail 0 2" >> /etc/fstab
  mount /data
fi
mkdir -p /data/postgres /data/caddy /opt/smartverify/admin

# Daily backup at 02:00 Addis Ababa time (23:00 UTC).
cat > /etc/systemd/system/smartverify-backup.service <<'UNIT'
[Unit]
Description=Back up the Smart Verify database to S3
[Service]
Type=oneshot
ExecStart=/bin/sh /opt/smartverify/app/deploy/backup.sh
UNIT
cat > /etc/systemd/system/smartverify-backup.timer <<'UNIT'
[Unit]
Description=Daily Smart Verify database backup
[Timer]
OnCalendar=*-*-* 23:00:00 UTC
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now smartverify-backup.timer
echo "server ready"
