# Production (AWS, eu-north-1)

One server runs everything with Docker: PostgreSQL, the API, and Caddy (HTTPS + the admin
website). Address: **https://51-21-74-119.sslip.io** (API at `/api/v1`, admin at `/sign-in`).

| What | Where |
| --- | --- |
| Server | EC2 `i-0ff4348b9a1981ed9` (t4g.small, Amazon Linux 2023), Elastic IP 51.21.74.119 |
| Database files | separate encrypted disk, mounted at `/data` (kept if the server is deleted) |
| Secrets | SSM Parameter Store `/smartverify/*` (SecureString) — never in git |
| Releases + backups | S3 `smartverify-401238232827-eu-north-1` (`release/`, `daily/` kept 14 days) |
| Access | no SSH: AWS Systems Manager (Run Command / Session Manager) |
| Firewall | `sg-0a002b4962bdd0993`: 80 and 443 only |

## Put a new version live

From the repo root (Git Bash, signed in with `aws login`):

```sh
export MSYS_NO_PATHCONV=1
B=smartverify-401238232827-eu-north-1
git archive --format=tar.gz -o /tmp/code.tar.gz HEAD backend deploy
(cd admin && EXPO_PUBLIC_API_URL=https://51-21-74-119.sslip.io/api/v1 npx expo export --platform web)
tar -czf /tmp/admin.tar.gz -C admin/dist .
aws s3 cp /tmp/code.tar.gz s3://$B/release/code.tar.gz
aws s3 cp /tmp/admin.tar.gz s3://$B/release/admin.tar.gz
aws ssm send-command --instance-ids i-0ff4348b9a1981ed9 --document-name AWS-RunShellScript \
  --parameters 'commands=["export AWS_DEFAULT_REGION=eu-north-1","mkdir -p /tmp/sv","aws s3 cp s3://smartverify-401238232827-eu-north-1/release/code.tar.gz - | tar -xz -C /tmp/sv","sh /tmp/sv/deploy/update.sh smartverify-401238232827-eu-north-1"]'
```

Database migrations run by themselves when the API starts.

## Change a secret or setting

`aws ssm put-parameter --name /smartverify/NAME --type SecureString --value '…' --overwrite`, then
run the update command above (it rereads them).

## Open a shell on the server

AWS console → Systems Manager → Session Manager → Start session → `smartverify`. Then
`sudo -i; cd /opt/smartverify/app/deploy` and use
`docker compose --env-file /opt/smartverify/.env.compose ps | logs api | …`.

## Backups and restore

Daily at 23:00 UTC (02:00 Addis) to `s3://…/daily/`, kept 14 days. Run one now:
`sudo systemctl start smartverify-backup.service`. To restore a backup (stops the API first):

```sh
aws s3 cp s3://smartverify-401238232827-eu-north-1/daily/<file>.sql.gz /tmp/b.sql.gz   # from your PC, then copy up
docker compose --env-file /opt/smartverify/.env.compose stop api
gzip -dc /tmp/b.sql.gz | docker exec -i smartverify-db-1 psql -U smartverify -d smartverify
docker compose --env-file /opt/smartverify/.env.compose start api
```

(The server itself may only write backups, not read them; restore from a downloaded copy.)
