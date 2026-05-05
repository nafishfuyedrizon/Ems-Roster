# Hello-Bot — Windows One-Click Ready

This version already includes the provided Discord bot token and timestamp channel ID.

## How to run

1. Extract the ZIP.
2. Open the `Hello-Bot` folder.
3. Double-click `RUN_WINDOWS.bat`.

On the first run, this single BAT file will handle setup, install dependencies, push the database schema, and then:

- Start the API Server
- Start the EMS Panel
- Start the Discord Bot
- Auto-open the website

Website:

```text
http://localhost:5173
```

Admin page:

```text
http://localhost:5173/admin
```

Default admin password:

```text
admin123
```

## Database note

If Docker Desktop is running on the PC, the script will create and run a MariaDB container named `hello-bot-mariadb`.

If Docker is not available, MySQL / MariaDB must already be running and the `.env.local` `DATABASE_URL` must match:

```text
mysql://DB_USER:DB_PASSWORD@DB_HOST:3306/DB_NAME
```

## Bot token

The token is included in `.env.local` and in the one-click script configuration. Do not share this ZIP with anyone else. If the token is reset later, update `.env.local` with the new token.

## Stop

Close the PowerShell windows that were opened to stop the services.

## Run parts separately

- `RUN_API_ONLY.bat`
- `RUN_PANEL_ONLY.bat`
- `RUN_BOT_ONLY.bat`

## Customize

- UI pages: `artifacts/ems-panel/src/pages/`
- Theme/CSS: `artifacts/ems-panel/src/index.css`
- API routes: `artifacts/api-server/src/routes/`
- Shift config defaults: `artifacts/api-server/src/routes/shift-config.ts`
- Discord duty parser: `artifacts/discord-bot/src/index.ts`
- DB schema: `lib/db/src/schema/`

## Updated Fix Notes

This build includes a fix for the Windows Drizzle schema path error. The previous error was:
`No schema files found for path config ... lib\db\src\schema\index.ts`

`RUN_WINDOWS.bat` now automatically:

1. Runs `pnpm install`
2. Checks Docker/MySQL readiness
3. Pushes the Drizzle schema
4. Imports data from `database_dump.json` if the database is empty
5. Starts the API server
6. Starts the EMS panel
7. Starts the Discord bot
8. Auto-opens the browser

Once the database has been imported, future runs will not erase new add/edit/delete changes. To reset everything from the bundled dump, run:
`RESET_DATABASE_FROM_DUMP.bat`

Admin login master keys:
`ADMIN_KEY_1`
or
`ADMIN_KEY_2`

