# EMS Website — Windows VPS Ready

This zip/package is prepared for running the website on a Windows VPS.

## What is included in this package

- `RUN_WEBSITE_SETUP.bat` — first-time setup + database schema push + dump import
- `RUN_WEBSITE.bat` — normal website start (API + Panel)
- `RUN_WEBSITE_BACKGROUND.bat` — background start without opening a browser
- `database_dump.json` — bundled data dump
- `.env.local.example` — config template

## VPS requirements

1. Node.js LTS
2. pnpm
3. MySQL / MariaDB database
   or an external MySQL / MariaDB connection
4. Windows firewall may need to allow the API/Panel ports
5. Domain reverse proxy / tunnel / web server mapping

## Important

This project is **MySQL / MariaDB compatible**.
`DATABASE_URL` must contain a MySQL connection string.

## Quick setup

1. Extract the zip
2. Check/update `.env.local`
3. Open a terminal in the project folder
4. Follow `HOSTING_SERVER_SETUP_NOTE.txt`

Website URL:

```text
http://localhost:5173
```

API health:

```text
http://localhost:5000/api/healthz
```

## 24/7 VPS mode

If you want to start in the background without a browser window, run `scripts/windows/start-website-background.ps1` from PowerShell.

This mode writes logs to:

```text
artifacts\runtime-logs\
```

## Recommended live setup

Best practice on a Windows VPS:

1. first time dependency + DB setup
2. API start
3. Panel start
4. Then use Task Scheduler or a service manager to run on boot

## Minimum env values

```text
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/hello_bot
API_PORT=5000
PANEL_PORT=5173
BASE_PATH=/
API_PROXY_TARGET=http://localhost:5000
ADMIN_MASTER_KEYS=your_key_1,your_key_2
```

If Discord login/bot is needed, add these values too:

```text
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=
DISCORD_BOT_TOKEN=
DISCORD_TIMESTAMP_CHANNEL_ID=
```

## Domain connect

To make the domain live, map these in the reverse proxy / web server:

- frontend -> `http://127.0.0.1:5173`
- api -> `http://127.0.0.1:5000`

## Database note

`database_dump.json` is bundled.
If the database is empty, the setup/import flow will import it.
If the database already exists, the script may skip import in protect mode.
If the target database is already prepared with the EMS tables and current data, schema push/import can be skipped and the API/Panel can be started directly.

For a fresh reset:

```bat
RESET_DATABASE_FROM_DUMP.bat
```

## Security note

If `.env.local` is included in this package, it is a sensitive file.
Before sharing, confirm that the database password, bot token, and admin keys are correct.
