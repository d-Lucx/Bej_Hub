# Private online Bej Hub

The free hosting setup uses **one Render web service** for Next.js and the Discord bot, **Supabase** for durable records and Google sessions, and optional **UptimeRobot** monitoring. It works independently of your computer while Render is running. Free hosting is best effort: Render can sleep, restart, or exhaust its monthly allowance; monitoring does not guarantee uptime.

The hosted office requires the exact owner Google email in `BEJ_OWNER_EMAIL`. This value stays in private environment settings. Both the page and every mission/history/review API verify access on the server. Knowing the website URL or a Supabase publishable key grants no access to mission data. Database tables and functions remain restricted to the server service role.

## 1. Supabase database

Use your existing Bej Hub project. In **SQL Editor**, run these files in order:

1. [`supabase/schema.sql`](../supabase/schema.sql) — existing mission tables and server-only write function; safe to rerun.
2. [`supabase/cloud.sql`](../supabase/cloud.sql) — durable queue, heartbeat, review-card registry, and atomic claims.

Then run `bej.cmd cloud-check` from the project folder to verify the tables and claim functions. It uses a nonexistent test ID and creates no mission or queue item.

In project settings / Connect, obtain:

| Render variable | Value |
| --- | --- |
| `SUPABASE_URL` | HTTPS project URL |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` key (a legacy `anon` key also works) |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` server key. A legacy `service_role` key can go here too. |

The Auth key and server key serve different purposes. Never put the server key in a `NEXT_PUBLIC_*` variable, a browser, GitHub, a screenshot, or chat. The app performs all database access on its server; no `anon` or `authenticated` table policy is needed.

To bring existing local history into the cloud after running the SQL, stop the local bot, then run this from the project folder:

```cmd
bej.cmd cloud-import
```

The importer uses your existing `.env` Supabase server credentials. It preserves newer remote records, skips interrupted running missions, expires old queued work, and makes no AI calls or Discord posts. Optional Supabase mirroring may already have copied most mission history.

## 2. Google OAuth

1. Create a project at [Google Cloud Console](https://console.cloud.google.com/).
2. Open **Google Auth Platform** (or APIs & Services → OAuth consent screen). Set the app name to **Bej Hub**, your support email, and your developer contact email.
3. Choose **External**, keep the app in **Testing**, and add **only your owner Google email** as a test user. Use only the default `openid`, email, and profile scopes.
4. Create an OAuth client of type **Web application**. Add the exact callback URL shown in **Supabase → Authentication → Sign In / Providers → Google**, usually:
   `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
5. Enter the Google client ID and client secret into **Supabase's Google provider** and enable it. Keep **Skip nonce checks** off. The client secret belongs in Supabase, not in this repository or the website.
6. Disable unused sign-in providers, including Email/password and Anonymous, in Supabase. The app itself exposes only Google sign-in and still enforces its verified owner allowlist.

## 3. Render deployment

Create a free [Render account](https://dashboard.render.com/) using GitHub. Then open:

**[Deploy Bej Hub Blueprint](https://dashboard.render.com/blueprint/new?repo=https://github.com/d-Lucx/Bej_Hub)**

Select your GitHub repository, use the tracked `render.yaml`, and confirm the service uses **Free** compute. No persistent disk or paid database is required. Fill the private environment values prompted by the Blueprint:

- `BEJ_OWNER_EMAIL`: your exact authorized Google email.
- The three Supabase values from step 1.
- Your existing `GEMINI_API_KEY` and Discord values from local `.env`.

The Blueprint selects `BEJ_STORAGE=supabase`, requires authentication, uses `gemini-3.5-flash-lite` with supplied sources, and runs the bot plus office together. Render's `RENDER_EXTERNAL_URL` supplies the canonical HTTPS origin automatically. For a custom domain, set `BEJ_PUBLIC_URL` explicitly to its exact HTTPS origin with no trailing path.

Keep **one instance** and **one bot process**. Stop your local `bej.cmd start` before starting the hosted service, so both computers do not react to the same Discord commands. Deploys are manual in the Blueprint so pushes do not unexpectedly restart an active mission.

The website shows a setup/unavailable response rather than exposing records if Auth or database settings are missing. Do not remove the authentication requirement to troubleshoot a deploy.

### If you created a Web Service manually

A manually created service does not automatically use `render.yaml`. On its **Settings** page, set these values explicitly:

| Setting | Value |
| --- | --- |
| Build Command | `pnpm install --frozen-lockfile --prod=false && pnpm run build` |
| Start Command | `pnpm run cloud` |
| Health Check Path | `/api/health` |

In **Environment**, set `NODE_VERSION=24`, `NODE_ENV=production`, `BEJ_STORAGE=supabase`, `BEJ_AUTH_REQUIRED=true`, and `BEJ_OWNER_EMAIL` to your allowed Google email. Add `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`, plus the Gemini and Discord settings listed in `render.yaml`. Enter their values privately in Render; copying a local `.env` file into GitHub is not necessary.

Do not use `pnpm run start` here: that command runs only the local bot and explicitly loads local `.env`. The cloud command starts both the website and bot and reads Render's injected environment variables. A `.env: not found` startup error means the service is using the local command.

If using **Add from .env**, replace local-only values afterward: `BEJ_STORAGE` must be `supabase`, `BEJ_AUTH_REQUIRED` must be `true`, and `BEJ_PUBLIC_URL` must be blank (use Render's automatic external URL) or your exact HTTPS office origin. Set `NODE_VERSION=24` even if a different version was selected previously. Save the configuration, then deploy the latest commit.

## 4. Finish Supabase redirect configuration

Once Render assigns an address such as `https://bej-hub-xxxx.onrender.com`, set:

- **Supabase → Authentication → URL Configuration → Site URL**: the exact Render HTTPS origin.
- **Redirect URLs**: `https://bej-hub-xxxx.onrender.com/auth/callback`.
- For local Google-login testing only, add `http://127.0.0.1:3000/auth/callback` too.

Use exact URLs, not wildcard redirect patterns. Google's redirect URI remains the **Supabase** callback from step 2; Supabase redirects back to the **Bej Hub** callback above.

## 5. Verify access before relying on the hosted bot

1. Open the hosted site in a private browser window. It must show the Google login page, with no mission history.
2. Visit `/api/office` without signing in. It must return **401**, without records.
3. Sign in with your owner Google account. The office and history should load.
4. Try another Google account. Google Testing or Bej Hub must deny it. Even if a non-owner Supabase user exists, the app must deny all office APIs.
5. Set `AI_MODE=mock` in Render temporarily, redeploy, and submit one short mission. Approve it; its Discord card should become **Review closed** within about five seconds. Test clarification/rejection as well.
6. Sign out and confirm history is inaccessible. After a Render restart, confirm stored history and pending reviews remain. Change back to `AI_MODE=gemini` when ready.

Unfinished work interrupted by a restart is never automatically rerun. A `RUNNING` mission is marked stale after 15 minutes. A `DELIVERING` mission has an uncertain delivery outcome: inspect Discord before submitting again. An interrupted queue claim is retained as `RUNNING` for manual inspection instead of silently repeating an external action.

## 6. Optional UptimeRobot monitor

Create an HTTP(S) monitor for **`https://YOUR-RENDER-HOST/api/health`**, using the free plan's available interval (usually five minutes). Expected response: HTTP 200 with `{"ok":true}`. Do not provide cookies, a Google session, API keys, or Discord credentials. This endpoint reveals no mission data and does not bypass authentication for any other route.

Monitoring can detect outages and may reduce idle sleeping. It cannot override Render's monthly free-instance hours, provider policies, maintenance, or suspension. If the service sleeps, Discord alone may not wake it; open the website and allow it to start.

## Local development remains available

Leave `BEJ_STORAGE=local`, `BEJ_AUTH_REQUIRED=false`, and `BEJ_PUBLIC_URL` blank in your local `.env` to retain the original localhost-only office. For local Google testing, set `BEJ_AUTH_REQUIRED=true`, `BEJ_PUBLIC_URL=http://127.0.0.1:3000`, your owner email, and the Supabase publishable key; restart the office.

Production always requires authentication even if `BEJ_AUTH_REQUIRED=false` is set accidentally. Auth uses HTTP-only, SameSite cookies, secure cookies on HTTPS, PKCE, verified Google identity checks, and server-side session validation. Mutations also require an exact matching Origin. Render and Supabase credentials stay server-side.

Reference: [Supabase server-side Auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [Google provider setup](https://supabase.com/docs/guides/auth/social-login/auth-google), [Render free service limits](https://render.com/docs/free), [Render Next.js hosting](https://render.com/docs/deploy-nextjs-app).
