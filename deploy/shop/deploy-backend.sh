#!/usr/bin/env sh
# Shop environment only: upload the committed backend + admin site and run deploy/update.sh on the
# Shop AWS server. Same steps as ../deploy-backend.sh, but every ID comes from config.env and it
# refuses to run unless you are signed in to the Shop AWS account.
set -e
export MSYS_NO_PATHCONV=1
HERE="$(cd "$(dirname "$0")" && pwd)"
[ -f "$HERE/config.env" ] || { echo "Copy config.env.example to config.env and fill it in."; exit 1; }
. "$HERE/config.env"
: "${ACCOUNT_ID:?}" "${REGION:?}" "${BUCKET:?}" "${INSTANCE_ID:?}" "${API_ADDRESS:?}"
export AWS_DEFAULT_REGION="$REGION"

# Never touch another account (the Restaurant production account is 401238232827).
NOW="$(aws sts get-caller-identity --query Account --output text)"
if [ "$NOW" != "$ACCOUNT_ID" ]; then
  echo "Signed in to account $NOW, expected $ACCOUNT_ID. Nothing was changed."
  exit 1
fi

cd "$HERE/../.."
TMP=".deploy-code.tar.gz"
git archive --format=tar.gz -o "$TMP" HEAD backend deploy
aws s3 cp "$TMP" "s3://$BUCKET/release/code.tar.gz" --only-show-errors
(cd admin && rm -rf dist && EXPO_PUBLIC_API_URL="https://$API_ADDRESS/api/v1" npx expo export --platform web >/dev/null)
ADMIN=".deploy-admin.tar.gz"
tar -czf "$ADMIN" -C admin/dist .
aws s3 cp "$ADMIN" "s3://$BUCKET/release/admin.tar.gz" --only-show-errors
echo "Admin website uploaded"
ID=$(aws ssm send-command --instance-ids "$INSTANCE_ID" --document-name AWS-RunShellScript \
  --parameters "commands=[\"export AWS_DEFAULT_REGION=$REGION\",\"rm -rf /tmp/sv\",\"mkdir -p /tmp/sv\",\"aws s3 cp s3://$BUCKET/release/code.tar.gz - | tar -xz -C /tmp/sv\",\"sh /tmp/sv/deploy/update.sh $BUCKET\"]" \
  --query Command.CommandId --output text)
echo "Deploy started ($ID), waiting..."
aws ssm wait command-executed --command-id "$ID" --instance-id "$INSTANCE_ID" || true
aws ssm get-command-invocation --command-id "$ID" --instance-id "$INSTANCE_ID" --query Status --output text
curl -s "https://$API_ADDRESS/api/v1/health"; echo
rm -f "$TMP" "$ADMIN"
