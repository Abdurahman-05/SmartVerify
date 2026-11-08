#!/usr/bin/env sh
# From your PC (Git Bash): upload the committed backend and run update.sh on the AWS server.
set -e
export MSYS_NO_PATHCONV=1 AWS_DEFAULT_REGION=eu-north-1
B=smartverify-401238232827-eu-north-1
cd "$(dirname "$0")/.."
TMP="${TMPDIR:-/tmp}/code.tar.gz"
git archive --format=tar.gz -o "$TMP" HEAD backend deploy
aws s3 cp "$TMP" "s3://$B/release/code.tar.gz" --only-show-errors
# Admin website (static files) — rebuilt each time so it matches the API.
(cd admin && rm -rf dist && EXPO_PUBLIC_API_URL=https://51-21-74-119.sslip.io/api/v1 npx expo export --platform web >/dev/null)
ADMIN="${TMPDIR:-/tmp}/admin.tar.gz"
tar -czf "$ADMIN" -C admin/dist .
aws s3 cp "$ADMIN" "s3://$B/release/admin.tar.gz" --only-show-errors
echo "Admin website uploaded"
ID=$(aws ssm send-command --instance-ids i-0ff4348b9a1981ed9 --document-name AWS-RunShellScript \
  --parameters "commands=[\"export AWS_DEFAULT_REGION=eu-north-1\",\"rm -rf /tmp/sv\",\"mkdir -p /tmp/sv\",\"aws s3 cp s3://$B/release/code.tar.gz - | tar -xz -C /tmp/sv\",\"sh /tmp/sv/deploy/update.sh $B\"]" \
  --query Command.CommandId --output text)
echo "Deploy started ($ID), waiting..."
aws ssm wait command-executed --command-id "$ID" --instance-id i-0ff4348b9a1981ed9 || true
aws ssm get-command-invocation --command-id "$ID" --instance-id i-0ff4348b9a1981ed9 --query Status --output text
curl -s https://51-21-74-119.sslip.io/api/v1/health; echo
