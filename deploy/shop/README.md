# Shop environment (separate AWS account)

A second, independent copy of the production setup for the Shop app. It uses the same code and the
same generic scripts as `../` (`update.sh`, `server-setup.sh`, `backup.sh`, `docker-compose.yml`,
`Caddyfile`), but its own AWS account, server, database, bucket and secrets. Nothing here touches the
Restaurant production account.

Only `deploy-backend.sh` and `config.env` differ: IDs come from `config.env`, and the script stops
unless `aws sts get-caller-identity` shows the Shop account.

## Parameters in SSM (`/smartverify/*`, SecureString) in the Shop account
Same names as the Restaurant ones (see ../README.md). The Shop server shares the Telebirr / M-Pesa
receipt relay on the Ethiopian hosting, so set the SAME values there:
`RECEIPT_RELAY_URL`, `RECEIPT_RELAY_KEY` (and `RECEIPT_RELAY_HOST` if used). `relay.php` checks only
the key and the allowed receipt sites, so no change is needed on the hosting. If the key is ever
rotated, change it in BOTH AWS accounts and in `relay.php`.
Also set `WEB_ORIGINS` (https://<API_ADDRESS>), `DB_PASSWORD`, `DATABASE_URL` is built by the
compose file. Shop sign-up needs no email: SES is not required for shop owners.

## Steps
1. `aws login`, then `aws sts get-caller-identity` shows the Shop account.
2. Create (Shop account only): EC2 server + SSM role, encrypted data disk mounted at `/data`,
   security group (80 and 443), Elastic IP, S3 bucket `$BUCKET` with `release/` and `daily/`.
3. Run `server-setup.sh` on the server (through Session Manager).
4. Put the SSM parameters.
5. `cp config.env.example config.env`, fill in `INSTANCE_ID` and `API_ADDRESS`.
6. `sh deploy/shop/deploy-backend.sh`. Migrations run when the API starts.
7. Build the Shop app with `EXPO_PUBLIC_API_URL=https://<API_ADDRESS>/api/v1`.
