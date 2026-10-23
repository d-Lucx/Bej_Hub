# Bej Hub v1.1

**Private studio · v1.1.0** · [Release notes](CHANGELOG.md) · [Original v1.0 release](https://github.com/d-Lucx/Bej_Hub/tree/v1.0.0)

A cozy pixel studio for an AI team. Assign a mission from Discord or the local office, follow the Manager → Researcher → Writer workflow, and review the draft before delivery.

Built with TypeScript, Discord.js, Gemini, Next.js, React, and Phaser. Supabase provides an optional private mirror of mission records. Run locally or deploy the office and bot together on Render with private Google sign-in.

## What works today

- Three agent personas share one Discord webhook, with progress messages and structured handoffs.
- A pixel office shows agent states, walking handoffs, idle coffee trips, mission history, a journal, token totals, and bot connectivity.
- Missions accept reference text. Researcher analyzes it without Google Search and cites it as `[S1]`.
- Conflicting premises or missing essential evidence pause the mission for clarification before Writer runs.
- Draft review is available through Discord buttons and the office. Approval delivers the saved draft; rejection ends the mission.
- A persistent local queue supports cancellation before work starts. Failed missions can be reviewed and resubmitted.
- Mock mode exercises the workflow without an AI key or token usage.

**Phase 3 is complete for the local MVP** (v1.0.0). Version 1.1 adds owner-only Google sign-in, authoritative Supabase storage, and free Render deployment configuration. Online access still requires your Google, Supabase, and Render setup. See the **[online setup guide](docs/ONLINE-SETUP.md)**.

| Original phase | Current status |
| --- | --- |
| 1 · Discord workflow | Working: Manager, Researcher, Writer, and shared-webhook personas |
| 2 · State and office | Local Phaser office and Supabase database mirroring work; the UI currently polls local records |
| 3 · Walking and human review | Complete locally: walking handoffs, idle motion, clarification, approval, and pixel identity |

The office uses authenticated polling in cloud mode; Supabase Realtime subscriptions remain optional future work.

## Online access

Follow **[Private online Bej Hub](docs/ONLINE-SETUP.md)** for the Supabase migration, Google OAuth, free Render deployment, history import, and optional UptimeRobot monitor. Hosting is best effort and can sleep. Production denies access unless Google authentication is configured, and only the configured owner email can access the office and its APIs.

Resolved Discord review cards now close automatically within about five seconds. On restart, the bot also recovers the latest 100 channel messages to close older cards. It needs View Channel and Read Message History permissions. New cards are persisted and tracked even after they leave that recent history window.

## Quick start

### First-time setup

Install Node.js **22.12+** and pnpm. In Windows Command Prompt:

```cmd
git clone https://github.com/d-Lucx/Bej_Hub.git
cd Bej_Hub
pnpm install --frozen-lockfile
if not exist .env copy .env.example .env
```

Edit `.env` with your Discord configuration. Start with `AI_MODE=mock`. See [Discord setup](#discord-setup) below.

The Windows launchers use Node from PATH and can also find this computer's bundled Codex Node runtime. In PowerShell, prefix launcher commands with `./`, for example `./bej.cmd start`.

### Daily use

Register commands once during setup, and again when command definitions change:

```cmd
bej.cmd register
```

Open two terminals in the project directory:

| Terminal | Command | Purpose |
| --- | --- | --- |
| 1 | `bej.cmd start` | Runs the Discord bot and processes office requests |
| 2 | `bej.cmd office` | Serves the local website |

Open **[http://127.0.0.1:3000](http://127.0.0.1:3000)**. Keep both terminals open. After a code or `.env` change, stop the bot with **Ctrl+C** and start it again.

For an account-free terminal demonstration, run `bej.cmd demo`. It always uses mock mode and saves a local mission record. Terminal demos and `live-test` print drafts locally and bypass final approval; use Discord or the office to test the review controls.

### Office motion

Click **Preview motion** above the room to watch a Manager → Researcher → Writer handoff without creating a mission, calling AI, or posting to Discord. Agents carry an envelope, follow paths around furniture, and return to their own desks. Idle agents sometimes visit a break spot and return; thinking dots, typing hands, monitor light, and review alerts reflect their current states.

**Pause motion** returns the agents to their desks and stops the room's motion. Your choice is saved in this browser, and the office also respects your operating system's reduced-motion setting. Status text remains available while motion is paused.

Live walking follows newly observed handoff events. Opening the office does not replay old history, and repeated polling does not replay the same handoff. Animations visualize transfers already handled by the workflow; they do not delay backend work or approval. Long-unseen events are skipped instead of creating an animation backlog.

## Discord setup

1. Create an application named **Bej Hub** in the [Discord Developer Portal](https://discord.com/developers/applications). Copy the Application ID and bot token into `.env`.
2. Install it in your server with the `bot` and `applications.commands` scopes. Grant **View Channels**, **Send Messages**, and **Embed Links** for review cards. Privileged gateway intents are unnecessary.
3. Create a private `#agent-office` text channel. Allow yourself and the bot to view and send messages there.
4. In that channel's **Integrations → Webhooks**, create one webhook and copy its URL into `.env`. It must target the configured channel.
5. Enable Discord Developer Mode, then copy your server ID, channel ID, and user ID. Add your user ID to `DISCORD_ALLOWED_USER_IDS`.
6. Run `bej.cmd register`, then `bej.cmd start`.

All commands, buttons, and clarification forms enforce the configured server, channel, and user allowlist. Webhook output disables mentions.

### Pixel avatars and favicon

| Bej Manager | Research Bot | Writer Bot |
| --- | --- | --- |
| <img src="public/avatars/manager.png" width="112" alt="Copper pixel manager with clipboard" /> | <img src="public/avatars/researcher.png" width="112" alt="Sage pixel researcher with glasses and magnifier" /> | <img src="public/avatars/writer.png" width="112" alt="Lavender pixel writer with pencil and notes" /> |

Agent messages automatically use these 512px PNG avatars from the versioned GitHub source. Keep the three `*_AVATAR_URL` values blank to use the release defaults, or supply your own HTTPS URLs. Restart the bot after changing avatar settings. Existing webhook messages retain the avatars used when they were sent.

`bej.cmd brand-discord` applies the matching studio mark to the main bot account and the office webhook's default profile. It validates the configured identities first, then updates their avatars without posting messages. Run it once during setup; new persona messages continue to use their individual avatars.

The website includes `app/favicon.ico` (16/32/48px), `app/icon.svg`, and a 180px touch icon. Original SVG sources and PNGs are committed under `public/`; regenerate them with `pnpm assets` or `node scripts/build-brand-assets.mjs`. No image-generation service or extra build dependency is required.

| Command | Action |
| --- | --- |
| `/mission prompt:… sources:…` | Starts the research and writing workflow |
| `/status` | Shows bot activity, AI mode, and session token usage |
| `/clarify mission_id:… response:…` | Resumes a mission with your clarification |
| `/approve mission_id:…` | Delivers a saved draft to the private office |
| `/reject mission_id:…` | Ends a paused mission without final delivery |

Use the **full mission ID** from the review card for review commands. Buttons fill in the ID automatically.

## Gemini and source handling

Set these values in `.env` to enable live generation:

```env
AI_MODE=gemini
RESEARCH_MODE=supplied
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=your_api_key
```

Create a key in [Google AI Studio](https://aistudio.google.com/apikey). Keep real keys in `.env`.

**Supplied-source mode is the default.** Paste reference content into `sources`; URLs alone are not fetched. A mission accepts up to **2,000 prompt characters** and **6,000 source characters**. The reference is sent to Gemini and saved in the local mission record. `[S1]` identifies supplied material, not independently verified web research.

`RESEARCH_MODE=google_search` enables Gemini Search grounding when no source text is supplied. Supplying `sources` always selects supplied-source analysis. Grounding requires model/tool access and available quota; the workflow stops if it receives no grounded citations. Live generation and Search availability depend on your account.

## Clarification and approval test

Restart the bot after updating the code. Use **New mission** in the office, or enter `/mission` in Discord and fill its two fields.

**Prompt**

```text
Write a 100-word introduction to Sinag Filipino as a film festival. Explain its history and how it supports independent Filipino filmmakers.
```

**Source text**

```text
Test scenario: Sinag Filipino is a proposed educational mobile application by LikhaTech Solutions. It helps Filipino children develop foundational reading and language skills through letter recognition, phonics, vocabulary practice, and short reading exercises. The app is designed for learners who need support with basic literacy. It is not a film festival and does not organize screenings or support independent filmmaking. These notes contain no film festival history or filmmaker programs.
```

**Expected result:** Researcher flags the conflict and the mission enters `WAITING_CLARIFICATION`. Writer should not generate a draft yet.

Click **Clarify** in Discord or answer in the office review card:

```text
Focus on the educational reading app described in the source. Write a friendly 100-word introduction for parents explaining how it could help children build basic literacy. Leave out film festivals and filmmaking.
```

The team should recheck the same source and produce a draft in `WAITING_APPROVAL`. Review the text, then click **Approve & deliver** or **Reject**. Approval sends the saved draft to the private Discord office without another AI call. A stale or repeated approval is rejected.

After clarification, Manager produces a task reflecting your corrected intent, and Researcher receives that resolved task without the discarded premise being appended again. The Writer is instructed to keep discarded interpretations and irrelevant negative disclaimers out of the final copy.

Conflict detection is model-assisted and can make mistakes. This test exercises a clear contradiction; optional missing tone or audience preferences alone should not trigger clarification. Resuming after clarification can use additional AI quota.

## Mission controls and persistence

| State | What happens next |
| --- | --- |
| `RUNNING` | The team is planning, researching, or writing |
| `WAITING_CLARIFICATION` | A human clarifies the request or rejects the mission |
| `WAITING_APPROVAL` | A human reviews the draft and approves or rejects it |
| `DELIVERING` | The approved draft is being sent to Discord |
| `COMPLETED` / `REJECTED` | The mission has ended |
| `FAILED` | Inspect the error, then use **Review & retry** if appropriate |

Paused missions survive bot restarts and free the office for other work. Office submissions wait in the local queue; Discord submissions receive a busy response while a mission is running. Queued work can be cancelled before it starts and expires after one hour. Running work finishes normally.

The website refreshes local records every 1.5 seconds. Bot status expires after 15 seconds without a heartbeat. Restart the bot if the office reports that it needs a restart. A connected website alone does not mean the bot is online.

Active work interrupted by a crash is not automatically replayed. A crash during delivery, or a leftover queue/review lock, needs manual inspection to avoid duplicate actions. **Review & retry** creates a new workflow; earlier Discord messages may already have been sent.

Office token totals cover recorded local missions. `/status` reports the current bot session. Neither is a billing meter; failed-call usage may be missing.

## Optional Supabase mirror

Follow [supabase/SETUP.md](supabase/SETUP.md), run [supabase/schema.sql](supabase/schema.sql) in your project's SQL Editor, and configure the server-only URL and secret key in `.env`.

```cmd
bej.cmd supabase-check
bej.cmd supabase-sync-check
```

The first command checks table access. The second mirrors an existing completed mock mission, reads it back, and checks for duplicate events. It leaves that mock record in Supabase.

Restart the bot to mirror local records every five seconds. Records include prompts, supplied references, progress events, and drafts. The local office continues to read local files; authenticated cloud access and Realtime subscriptions are future work.

## Development commands

| Command | Purpose |
| --- | --- |
| `bej.cmd demo` | Offline terminal demonstration with zero AI usage |
| `bej.cmd live-test` | Live local Gemini workflow; consumes quota, sends nothing to Discord |
| `bej.cmd check` | Checks the bot and shared TypeScript code |
| `bej.cmd test` | Runs all offline tests |
| `bej.cmd close-reviews` | Close resolved review cards in up to 2,000 recent Discord messages |
| `bej.cmd cloud-check` | Verify cloud tables and atomic functions without running a mission |
| `bej.cmd cloud-import` | Copy local history to Supabase without executing queued work |
| `bej.cmd brand-discord` | Applies the studio mark to the main bot and webhook profiles |
| `pnpm assets` | Rebuilds favicon, touch icon, and avatar files |
| `pnpm exec tsc --project tsconfig.web.json --noEmit` | Checks web TypeScript code |
| `pnpm exec tsx src/audit-staged.ts` | Checks staged files against configured secrets and common credential patterns |

GitHub Actions runs both TypeScript checks and the offline tests without service credentials. The staged audit is a targeted check, not a comprehensive secret scanner.

## Project layout

| Path | Contents |
| --- | --- |
| `app/` | Next.js office, Phaser room, mission and review endpoints |
| `src/studio.ts` | Workflow, saved state, clarification, approval, and delivery |
| `src/providers.ts` | Mock/Gemini adapters, structured output, and source analysis |
| `src/bot.ts`, `src/discord*.ts` | Discord commands, personas, and review cards |
| `src/queue-store.ts`, `src/web-queue.ts` | Persistent queue and cancellation controls |
| `src/office-motion.ts` | Furniture-aware A* paths, movement, and handoff-event deduplication |
| `public/avatars/`, `public/brand/` | Original pixel identity assets and Discord-ready images |
| `scripts/build-brand-assets.mjs` | Reproducible, dependency-free SVG/PNG/ICO asset builder |
| `src/supabase*.ts`, `supabase/` | Optional database mirror and setup |
| `tests/` | Offline workflow, permissions, concurrency, and review tests |
| `data/` | Private runtime records; ignored by Git |

`.gitignore` excludes credentials, runtime data, dependencies, builds, caches, logs, reports, backups, and OS/editor metadata. Source, tests, SQL, `.env.example`, `pnpm-lock.yaml`, and `AGENTS.md` stay versioned so the project can be reproduced and maintained.

The office currently binds to loopback on port 3000 and uses local access checks. Hosted use requires authentication and per-user authorization before deployment. Keep the bot and computer running while using the local studio.
