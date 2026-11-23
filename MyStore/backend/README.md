# Backend (Node.js + Express + MySQL)

## 1. First-time setup

1. Run `npm ci` in the backend directory.
2. Copy `.env.example` to `.env` and set your MySQL connection and JWT secret.
3. For a **new, empty** MySQL 8.4 database, import the schema and run the migrations in order:

   ```sh
   mysql -u YOUR_DB_USER -p YOUR_EMPTY_DB < schema.sql
   mysql -u YOUR_DB_USER -p YOUR_EMPTY_DB < migrations/001-admin-user-audit.sql
   ```

   Use a schema owner that can create routines, views, triggers and events. The import contains
   no account or catalogue data. The server uses the database name in `DB_NAME`.

4. On a new store, register the intended administrator through the app and promote that account
   in MySQL. Add an active warehouse before adding stock. For example, run the following after
   replacing the email with the account you just registered:

   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'owner@example.com';
   INSERT INTO warehouses (name) VALUES ('Main Warehouse');
   ```

5. Run `npm run dev` and check `http://localhost:5001/api/health`.

For an existing database that already has Phase 1 and Phase 3, keep that schema and data.
Apply only outstanding migrations, including `001-admin-user-audit.sql` if pending.
The audit records subsequent admin changes.

### Production routing

Build the frontend with `npm ci` and `npm run build` in `frontend/`. Keep the output at
`frontend/dist/` beside `backend/` and run the backend with `NODE_ENV=production` and
`npm start`. Express serves the frontend, `/api`, and `/uploads` on the same origin.
Set `CLIENT_URL` to the public HTTPS origin and keep `backend/uploads/` on persistent storage.

For separate static hosting, configure that host to forward `/api/*` and `/uploads/*` to
the backend and serve `index.html` for frontend routes such as `/shop` and `/admin/users`.
Keep those forwarding rules ahead of the frontend fallback.

### alwaysdata Free portfolio demo

Use a separate, empty MariaDB 11.8 database for this non-commercial demo. From the project root,
generate the import file and build the demo storefront:

```sh
node backend/scripts/prepare-alwaysdata-demo.js > alwaysdata-demo.sql
npm --prefix frontend ci
VITE_PORTFOLIO_DEMO=true npm --prefix frontend run build
```

The prepared archive already contains the import file and built frontend. The import file contains
the schema, migrations and fictional catalogue data. It excludes database
events, user accounts and order data. Import it once into the new demo database. Keep
`frontend/dist/` beside `backend/` on the host. Upload backend source and package files separately
from the local `.env`, backups and uploads. Run `npm ci --omit=dev` in the deployed backend directory.

In the backend directory create a private `.env` using the demo database credentials, a new JWT
secret, and these settings. Replace the example account and address with your own values.

```dotenv
NODE_ENV=production
CLIENT_URL=https://ACCOUNT.alwaysdata.net
UPLOAD_DIR=/home/ACCOUNT/mystore-data/uploads
TRUST_PROXY=1
RATE_LIMIT_DISABLED=false
```

Set the exact demo `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` and `DB_PASSWORD` from the control
panel. Create a **Node.js** site using Node 22 or 24, with the backend as its working directory and
`node server.js` as the command. The app listens on the host-supplied `IP` or `HOST` and `PORT`.
Use the provided HTTPS hostname. Keep the upload folder outside the release directory and keep it
when replacing the app files. Sample product photos are bundled with the frontend.

Register your private demo admin account, then use phpMyAdmin on the demo database to check the
account and promote it once. Replace the email with the account you registered.

```sql
UPDATE users SET role = 'admin' WHERE email = 'demo-owner@example.com';
```

Create a daily **Command** task in the alwaysdata control panel with
`node /home/ACCOUNT/mystore/backend/scripts/daily-low-stock.js`, adjusting the path to your backend.
The task reads the backend's private `.env` and calls the low-stock procedure. The public demo coupon
is `PORTFOLIO10`. Test with fictional contact details and keep admin credentials private.

## 2. Environment variables (.env)
| Variable | Meaning |
|---|---|
| `PORT` | API port (5001 in this project) |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (`DB_PORT` optional) | MySQL connection |
| `JWT_SECRET` | Random string, at least 32 characters. In production the server refuses to start without it |
| `JWT_EXPIRES_IN` | Token lifetime, for example `7d` |
| `CLIENT_URL` | The frontend's address (CORS). Always set it in production |
| `UPLOAD_DIR` | Optional absolute path for persistent uploaded files. Defaults to the backend uploads directory |
| `NODE_ENV` | `production` hides error details and enforces the checks above |
| `TRUST_PROXY` | Set to `1` when running behind a hosting platform or reverse proxy (so rate limits see real visitor IPs) |
| `RATE_LIMIT_MAX` | Requests per IP per 15 minutes for the whole API (default 600) |
| `AUTH_RATE_LIMIT_MAX` | Failed logins / sign-ups / password attempts per IP per 15 minutes (default 20) |
| `RATE_LIMIT_DISABLED` | `true` switches rate limits off (only for automated testing) |
| `MYSQLDUMP_PATH`, `BACKUP_KEEP` | Backup script: path to `mysqldump` if it is not in PATH, and how many backups to keep (default 14) |

Generate a good secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## 3. Scripts (add these lines to "scripts" in package.json)
```
"test": "node --test \"tests/unit/*.test.js\"",
"test:e2e": "node --test \"tests/e2e/*.test.js\"",
"backup": "node scripts/backup.js"
```

## 4. Tests
- `npm test` : unit tests, no database needed (price, coupon and delivery rules, image checks).
- `npm run test:e2e` : end-to-end tests against the RUNNING backend and your database.
  `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret npm run test:e2e`
  They register test customers, create a test product and coupon, check checkout, stock, coupons,
  cancellation, role protection and the overselling race (two buyers, one item), then deactivate what they created.
  While running them repeatedly, set `RATE_LIMIT_DISABLED=true` in `.env`.

## 5. Backup and restore
- Backup: `npm run backup` -> `backups/ecommerce_inventory_db_YYYY-MM-DD-HH-MM.sql`
  (includes tables, data, views, procedures, functions, triggers and events).
- Restore into an empty or test database:
  `mysql -u root -p ecommerce_inventory_db < backups/<file>.sql`
- Schedule it (macOS/Linux): run `crontab -e` and add
  `0 2 * * * cd /full/path/to/backend && /usr/local/bin/node scripts/backup.js >> backups/backup.log 2>&1`
- Keep copies OFF this computer too (external disk or cloud storage). A backup on the same disk does not survive a disk failure.
- Test a restore at least once. A backup that has never been restored is only a hope.

## 6. Security measures in this backend
- Passwords hashed with bcrypt; maximum 72 bytes (what bcrypt really reads); emails normalised to lower case.
- JWT login; the user's CURRENT role and status are read from the database on every request, so demotion or deactivation applies immediately.
- Rate limits on the whole API and stricter limits on login, sign-up and password change.
- `helmet` security headers, 100 KB request body limit, CORS limited to `CLIENT_URL`.
- All SQL uses placeholders (no SQL injection); sort options come from fixed lists.
- Uploads: admin only, JPG/PNG/WEBP/GIF only, 2 MB, random server-chosen file names, and the file content is checked against its declared type.
- Prices, coupons, delivery charge and totals are always calculated on the server inside a database transaction with row locks.
- Error details are hidden in production.

## 7. Before going live (checklist)
- [ ] `NODE_ENV=production`, strong `JWT_SECRET`, `CLIENT_URL` set, `TRUST_PROXY` set if behind a proxy
- [ ] HTTPS everywhere (hosting platforms provide it)
- [ ] A dedicated MySQL user for the app (not `root`) with rights only on this database
- [ ] Automatic backups scheduled and one restore tested
- [ ] MySQL Event Scheduler on: `SET GLOBAL event_scheduler = ON;` (also set it in the server config so it survives restarts)
- [ ] `uploads/` and `backups/` stored safely (and listed in `.gitignore` together with `.env` and `node_modules`)
