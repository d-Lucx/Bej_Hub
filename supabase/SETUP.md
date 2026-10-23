# Connect the studio to Supabase

The local office already follows Discord missions from `data/missions`. It polls every 1.5 seconds. You do not need Supabase to preview or use the office on this computer.

1. Create a project named Bej Hub at https://supabase.com/dashboard. Save your database password privately.
2. Open the project's SQL editor. Paste `supabase/schema.sql` and run it. It creates `agents`, `missions`, and `agent_logs`, with Row Level Security enabled and browser access denied.
3. Open the project's **Connect** dialog to copy the Project URL. In **Settings → API Keys → Publishable and secret API keys**, copy a secret key beginning with `sb_secret_` (create one if none exists). Put the two values in the root `.env`:

   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SECRET_KEY=sb_secret_your_key
   ```

   Use the secret key, not the publishable key. Keep it in `.env`, never in a `NEXT_PUBLIC_` variable or chat. Existing legacy service-role keys are also supported under `SUPABASE_SERVICE_ROLE_KEY`; a new secret key is preferred.
4. Run `bej.cmd supabase-check`. It checks access to all three tables without returning rows or changing data. If it reports 404, run the schema first; if it reports 401/403, check the key and permissions. This test does not verify the write function.
5. Restart `bej.cmd start`. The bot mirrors existing and updated local mission records every five seconds, including prompts, supplied sources, and drafts. Temporary sync failure leaves the local workflow running and retries later. Inspect the tables in Supabase to confirm records arrive. Leave the Supabase variables blank if you want all mission data to remain local.

For a write/read verification, run `bej.cmd supabase-sync-check`. It mirrors the newest completed local mock mission, reads back the mission and its progress events, repeats the sync to check for duplicate events, and checks that all three agent records exist. The mirrored mock mission remains in your project. No Gemini calls or Discord messages are made.

The local UI continues to read local files; it does not yet subscribe to Supabase. This first connector is an optional private database mirror, not a hosted realtime deployment. Do not deploy the current local routes to Vercel: access is deliberately restricted to loopback. The next hosted step needs Supabase Auth, per-user read/queue policies, and an authenticated Realtime subscription before replacing local files. No anonymous policy should expose prompts, reference text, or drafts.

The stored `thought_summary` is a short progress message, not private model reasoning. Mission snapshots include your supplied text and generated draft. `model_used` currently records provider mode (Gemini/mock); exact model accounting can be added with the hosted schema migration.

References: https://supabase.com/docs/guides/getting-started/api-keys, https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/realtime/postgres-changes.
