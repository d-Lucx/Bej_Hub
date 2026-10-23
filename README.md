# Bej Hub · Local virtual studio

## Phase 2 local cozy office

Run `bej.cmd office` in a second terminal, then visit http://127.0.0.1:3000. Restart `bej.cmd start` in the bot terminal after this update to activate the web mission queue. Keep both running: the office reads saved mission events every 1.5 seconds, and the bot processes queued web missions sequentially. Sending a web mission uses the same configured provider and posts the agent updates to your private Discord office.

Click a pixel teammate or their inspector button to view status. New mission accepts a prompt and supplied reference text. Studio journal follows the latest mission; Mission history expands saved drafts. Token totals are from local mission history, not a billing meter. This release includes original Phaser pixel artwork and state bubbles, not walking/pathfinding yet. Old interrupted records are shown as stale after 15 minutes. Queue requests expire after one hour; interrupted RUNNING requests are not automatically replayed.

The local API is limited to loopback hosts on port 3000; submissions require a matching Origin. This is a local single-user preview, not a production authentication system. Do not expose it through a public tunnel or deploy it as-is. See `supabase/SETUP.md` for the optional private mirror and the remaining hosted Auth/Realtime work.

The office now shows bot liveness separately from website connectivity. Restart the bot to enable its heartbeat; status becomes offline after 15 seconds without an update. Mission queue includes a Cancel button only for queued work. Once a mission starts it finishes normally. Failed missions offer **Review & retry** in Mission history: review/edit the prefilled prompt and sources, then submit a new mission explicitly. Earlier messages may already be in Discord; retries can use more AI quota. New missions preserve sources before the manager starts. Old missions that failed before research may require sources to be pasted again.

Queue start and cancellation share a short-lived per-record lock to prevent both from winning. A process forcibly killed during a file update can leave a `.lock` file; the queue will leave that record alone rather than risk a duplicate run. Interrupted RUNNING requests also require manual review and are not replayed automatically.

A Discord virtual studio: Manager → Researcher → Writer. The team produces a brief and draft post in your private office. TypeScript, Discord.js, Gemini, and a local Next.js/Phaser office; Supabase mirroring is optional.

## Try it without accounts

Use Node.js 22.12+ and pnpm (or npm):

```powershell
pnpm install
pnpm demo
pnpm check
pnpm test
```

The demo always uses mock mode, prints each persona's messages, saves a mission JSON file under `data/missions`, and uses zero AI tokens. Mock output is labeled and is not research. If using npm instead, use `npm install` and `npm run demo`, etc.

On this machine dependencies are already installed. Since npm/pnpm are not on PATH, you can use `./bej.ps1 demo`, `./bej.ps1 check`, `./bej.ps1 test`, `./bej.ps1 register`, and `./bej.ps1 start` from PowerShell instead of the pnpm commands below.

In Windows Command Prompt, use `bej.cmd register` and then `bej.cmd start`. The `bej.cmd` launcher also supports `demo`, `check`, and `test`, and finds the bundled Node runtime if Node is not on PATH. In PowerShell, use `./bej.cmd register` and `./bej.cmd start`.

## Create the Discord bot in your existing server

1. Open https://discord.com/developers/applications and create an application named **Bej Hub**. Copy its Application ID from General Information.
2. Open **Bot**, create the bot if needed, and reset/copy its token. Keep the token only in your local `.env`; do not paste it into chat. You do not need Message Content or other privileged intents.
3. Under **OAuth2 → URL Generator**, select `bot` and `applications.commands`. Select only View Channels and Send Messages. Open the generated installation link and choose your server. Do not grant Administrator.
4. Create a text channel named **agent-office**. Make it private: deny View Channel to `@everyone`; allow yourself and Bej Hub to view and send messages. Check that no other roles grant unwanted access.
5. In that channel's **Edit Channel → Integrations → Webhooks**, create one webhook named Bej Hub and copy its URL. It must target this same channel. The code uses it with three different display names. Optional HTTPS avatar URLs give each persona a different image; no custom sprite artwork is bundled yet.
6. In Discord **User Settings → Advanced**, enable Developer Mode. Right-click your server, the office channel, and your user profile to copy their IDs.
7. Copy `.env.example` to `.env`, then fill in the bot token, application ID, server ID, channel ID, webhook URL, and your user ID in `DISCORD_ALLOWED_USER_IDS`. Keep `AI_MODE=mock` initially.
8. Run `pnpm register` once to install `/mission` and `/status` in your server. Run `pnpm start` and leave the terminal running.
9. In `#agent-office`, try `/mission prompt: Research how a virtual studio helps solo creators and draft a welcome post`. You should see all three personas and a clearly labeled mock draft. `/status` shows activity and session token usage.

This project does not create a server, bot, webhook, or channel automatically. Registration changes Discord only when you run it with your credentials. Commands are restricted to the configured server, channel, and allowed user IDs. Webhook output disables mentions, including `@everyone`.

## Enable real Gemini research

### Supplied-source mode (current default)

Set `RESEARCH_MODE=supplied` in `.env`. Run `bej.cmd register` again to add the new `sources` option, then restart with `bej.cmd start`. With `AI_MODE=gemini`, the full Manager → Researcher → Writer workflow uses Gemini generation without Google Search grounding.

Example Discord command:

```text
/mission prompt: Write a welcome post for Bej Hub
         sources: Bej Hub is a virtual studio with a Manager, Researcher, and Writer. Missions are submitted in a private Discord office. The 2D office is planned; there is no launch date yet.
```

Paste reference content (up to 6000 characters), not just a URL: links are not fetched. Researcher analyzes only that material and uses `[S1]` citations. Both outputs are labeled as supplied-source work, not independently verified web research. The reference text is saved in the private local mission record and sent to Gemini for analysis. Missing reference text is rejected before any AI call in this mode.

`bej.cmd live-test` now uses a small supplied project-notes fixture by default, running the complete workflow locally without Discord delivery. Set `RESEARCH_MODE=google_search` explicitly to use the previous grounded live test and source-search behavior. Supplying the `sources` option always selects supplied-source analysis, even when the configured default is Google Search.

Run `bej.cmd live-test` to verify a real research → draft workflow locally using the key and model in `.env`. This consumes API quota but sends no Discord messages, and works even while `AI_MODE=mock`. After a successful test, set `AI_MODE=gemini` and restart the bot. The selected default is `gemini-3.5-flash-lite`.

Create an API key at https://aistudio.google.com/apikey, set `GEMINI_API_KEY` locally, set `AI_MODE=gemini`, and restart. `GEMINI_MODEL` is configurable; the initial setting is `gemini-3.5-flash-lite`. Verify that the selected model and Google Search grounding are available for your account before using live mode. Free quotas and grounding availability vary; this project does not guarantee zero-cost live execution.

The manager returns a validated JSON plan. The researcher calls Google Search grounding and refuses to proceed without source chunks and citation support metadata. The writer returns a validated JSON title/body based on the brief. Source URLs accompany both outputs; complete grounding metadata is retained in the mission record. Sources are evidence, not a guarantee that every claim is correct: the final message is explicitly a draft.

Transient Gemini HTTP 429 and 5xx failures retry up to twice with backoff, respecting Google's RetryInfo and Retry-After delays. Delays over 60 seconds and explicit daily/zero quotas stop automatic retries. Errors now include Google's reason and quota identifiers, with the API key redacted. Requests time out after 90 seconds. Invalid output or missing citations fails the mission. No silent substitution with mock output occurs in live mode. Cross-provider fallback is deferred until you choose and configure a second provider.

## Phase 1 boundaries

- One mission runs at a time. Additional requests receive a busy response; there is no persistent queue yet.
- Mission snapshots and structured state events are stored locally. Restarting the process does not resume interrupted work. Token counters are session-only and count usage returned by successful provider steps, not billing totals or failed-call usage.
- Delivery failure marks the mission failed. Earlier messages may already have arrived; there is no automatic workflow replay that could duplicate a complete post.
- Drafts and progress are automatically posted only to your office webhook. No publishing outside the office, code execution, browser automation, or approval commands are included in this phase.
- Persona avatars are optional URLs. Pixel art, walking animations, the Next.js/Phaser room, and Supabase remain future phases.
- Keep the local process and computer awake for testing. Render free web services sleep after idle time and are unsuitable for a reliable always-on Gateway bot. Choose hosting before deploying; no deployment has been performed.

## Project map

- `src/studio.ts`: deterministic orchestration, handoffs, logs, and single-mission guard.
- `src/providers.ts`: mock and Gemini adapters; JSON validation and grounded research.
- `src/bot.ts`, `src/discord.ts`: commands, access checks, shared webhook personas.
- `src/register.ts`: registers commands without deleting other commands.
- `data/missions/`: private local prompts, research, drafts, events, and usage; excluded from Git.
- `tests/studio.test.ts`: workflow, persistence, concurrency, failure, access, chunking, and provider validation checks.

Next checkpoint: create the Discord application and configure `.env`, run the mock mission in the channel, then validate one narrow Gemini mission before Phase 2.

References: [Discord commands](https://docs.discord.com/developers/docs/interactions/slash-commands), [Discord.js guide](https://discordjs.guide/), [Gemini grounding](https://ai.google.dev/gemini-api/docs/google-search), [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output), [Render free-service limits](https://render.com/docs/free).
