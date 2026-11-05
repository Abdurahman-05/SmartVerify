#!/bin/sh
# Receipt relay on the Ethiopian VPS: tinyproxy that opens only the Telebirr and M-Pesa receipt
# sites (they answer only Ethiopian addresses), only for the AWS server, only with a password.
# Nothing is stored here: the receipt pages pass through encrypted (HTTPS CONNECT).
#
# Usage (on the VPS):  sudo sh setup.sh <aws server ip> [extra test ip]
# The password is made once in /root/relay-password (root only, never printed); put
#   http://gebtual:<password>@<vps ip>:443  in the AWS secret /smartverify/RECEIPT_PROXY_URL.
# Port 443: the provider's network firewall only lets standard ports through.
set -eu
AWS_IP="$1"
TEST_IP="${2:-}"
PORT=443
export DEBIAN_FRONTEND=noninteractive

apt-get update -qq
apt-get install -y -qq tinyproxy ufw fail2ban unattended-upgrades >/dev/null

if [ ! -s /root/relay-password ]; then
  umask 077
  head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32 > /root/relay-password
fi
umask 022
PASS="$(cat /root/relay-password)"

cat > /etc/tinyproxy/filter <<'EOF'
^transactioninfo\.ethiotelecom\.et$
^m-pesabusiness\.safaricom\.et$
EOF
chmod 644 /etc/tinyproxy/filter
# Ubuntu's AppArmor only lets tinyproxy read files it knows: add the allow-list.
echo "  /etc/tinyproxy/filter r," > /etc/apparmor.d/local/tinyproxy
apparmor_parser -r /etc/apparmor.d/tinyproxy

{
  echo "User tinyproxy"
  echo "Group tinyproxy"
  echo "Port $PORT"
  echo "Listen 0.0.0.0"
  echo "Timeout 30"
  echo "MaxClients 50"
  echo "LogLevel Notice"
  echo "Syslog On"
  echo "DisableViaHeader Yes"
  echo "Allow $AWS_IP"
  [ -n "$TEST_IP" ] && echo "Allow $TEST_IP"
  echo "BasicAuth gebtual $PASS"
  echo "Filter \"/etc/tinyproxy/filter\""
  echo "FilterExtended On"
  echo "FilterDefaultDeny Yes"
  echo "FilterURLs Off"
  echo "ConnectPort 443"
} > /etc/tinyproxy/tinyproxy.conf
chmod 640 /etc/tinyproxy/tinyproxy.conf
chgrp tinyproxy /etc/tinyproxy/tinyproxy.conf

# A port below 1024 needs this capability.
mkdir -p /etc/systemd/system/tinyproxy.service.d
printf '[Service]\nAmbientCapabilities=CAP_NET_BIND_SERVICE\n' \
  > /etc/systemd/system/tinyproxy.service.d/port.conf
systemctl daemon-reload
systemctl enable tinyproxy >/dev/null 2>&1
systemctl restart tinyproxy

# Firewall: SSH stays open (never lock ourselves out); the relay only for the allowed addresses.
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp >/dev/null
ufw allow from "$AWS_IP" to any port "$PORT" proto tcp >/dev/null
[ -n "$TEST_IP" ] && ufw allow from "$TEST_IP" to any port "$PORT" proto tcp >/dev/null
ufw --force enable >/dev/null

# SSH: keys only, once a key is in place.
if [ -s "/home/${SUDO_USER:-abdu}/.ssh/authorized_keys" ]; then
  printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n' \
    > /etc/ssh/sshd_config.d/90-keys-only.conf
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
fi

systemctl enable --now fail2ban >/dev/null 2>&1
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null 2>&1 || true

echo "tinyproxy: $(systemctl is-active tinyproxy)"
echo "fail2ban:  $(systemctl is-active fail2ban)"
ufw status
