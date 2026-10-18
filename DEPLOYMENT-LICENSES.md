# NASAQ Studio+ — account approval and licensing

This release adds a license-gated desktop login plus a separately deployable Node.js/PostgreSQL API and bilingual admin portal. It is a deployment-ready **foundation**, not a live hosted service: no hosting account, database, production domain, or secret was supplied, so it cannot verify accounts until you deploy and configure the API.

## Current policy implemented

- New sign-ups are stored as `pending` and cannot use the plugin.
- An administrator must approve the user.
- An administrator must then record/review payment and create either a monthly subscription (1–36 months) or lifetime license.
- Each license permits one active device. The device ID is a random per-installation UUID stored in the app's user-data directory; it is not a hardware fingerprint.
- The plugin checks the API on launch and when the app regains focus. Sessions are encrypted with Electron `safeStorage` on supported systems; the plugin refuses to persist a session if secure storage is unavailable.
- The admin portal provides user approval/suspension, license issuance, manual payment records, device revocation, audit log, and overview counts.
- API password hashes use bcrypt; JWTs expire after 12 hours; authentication routes are rate-limited; SQL calls are parameterized; security headers are enabled.

## 1. Required accounts/services

You need:

1. A PostgreSQL database (managed PostgreSQL such as Neon, Supabase Database, Render PostgreSQL, or a secured PostgreSQL server).
2. A Node.js 22 hosting service that supports environment variables and HTTPS (Render, Railway, Fly.io, or your own VPS with a reverse proxy and TLS).
3. A domain/subdomain such as `license.yourdomain.com` pointing to the API host. HTTPS is mandatory for public deployment.

No payment gateway is needed for the selected manual-payment model. There is no SMTP/email-verification integration in this release. Before broad commercial launch, add admin MFA and email verification/recovery, and configure database backups/monitoring.

## 2. Deploy the API

The backend source is in `license-server/`.

1. Create a PostgreSQL database and copy its connection string.
2. Run `license-server/migrations/001_init.sql` against that database using the database console or `psql`.
3. Deploy `license-server/` as a Node web service. Set its start command to `npm install && npm start` (or use its Dockerfile).
4. Set these environment variables in the hosting dashboard, not in source code:
   - `DATABASE_URL` = the private database connection string
   - `JWT_SECRET` = a cryptographically random value of at least 48 characters; generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `PORT` = host-provided port (often automatic)
   - `TRUST_PROXY=1` only if the host runs behind one trusted proxy; configure appropriately for your provider
   - `PGSSL=enable`; keep `PGSSL_VERIFY=true` so the database certificate is verified; only disable verification temporarily for a trusted staging environment with a documented reason
5. Add HTTPS and check `https://YOUR-DOMAIN/api/health`. It should return `ok: true` and `database: connected`.
6. Create the first admin on the server using the same database environment variables:
   `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='use-a-long-unique-password' node create-admin.js`
   This inserts an admin only if that email does not already exist. Run it from `license-server/`. Do not use a shared/default password.

Keep `JWT_SECRET`, database credentials, and admin credentials out of Git, the plugin, and screenshots. Restrict database access to the API host where possible.

## 3. Point the Windows plugin to the API

Create this file in the app's Electron user-data directory (normally `%APPDATA%\nasaq-studio\license-config.json`):

```json
{
  "apiUrl": "https://license.yourdomain.com"
}
```

Replace the example domain with your actual HTTPS API domain. Alternatively, launch the app with `NASAQ_API_URL` set in the process environment. Do not use a public HTTP URL. For local development only, `http://127.0.0.1:8787` is the default.

After configuring, restart NASAQ Studio+. The plugin will display its login/register gate. New users register, you approve them in the admin portal, review their manual payment, then issue a subscription or lifetime license. The user can then sign in on one device.

## 4. Admin portal

Open `https://license.yourdomain.com/` and sign in using the admin account created above. The first page is the bilingual dashboard. Use Users to approve accounts and create licenses, Payments to record manual transfers, Devices to revoke device activations, and Audit Log to inspect events.

The API intentionally has no default administrator and no public admin-signup route.

## 5. Known limitations before commercial scale

- This does not make Electron code impossible to copy or reverse-engineer. The server controls approval and active license status, but local features can still be modified by a determined attacker. Consider code signing, ASAR packaging, update signing, integrity checks, and moving valuable proprietary logic server-side where practical.
- There is no built-in admin MFA, email verification, password reset/email delivery, or payment gateway. Add these before inviting a large paid customer base.
- Manual payment confirmation and license issuance are separate actions by design; confirming a payment record does not automatically issue a license.
- The admin revenue number is the sum of confirmed payment records; it is not accounting/tax software and does not automatically subtract refunds.
- Network access is required to log in and validate a license. This version does not provide an offline grace period.
- Device IDs are per-installation identifiers, not hardware fingerprints. Users can reinstall/reset app data; support/admin procedures are needed for legitimate device changes.
- This environment cannot run the Windows Photoshop COM bridge or test the live hosting/database, so test on a copied PSD and a staging deployment before release.

## Local API development

From `license-server/`:

```bash
npm install
# configure environment variables in your shell or a private .env file ignored by Git
npm start
```

Run the SQL migration before starting the API. Never commit a real `.env` file.
