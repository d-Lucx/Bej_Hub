# Changelog

## v1.0.0 — 2026-10-23

First release of the local Bej Hub virtual studio, completing the local Phase 3 milestone.

### Studio and identity

- Cozy Phaser pixel office with three workstations, plants, a sofa, and a coffee nook.
- Furniture-aware walking handoffs, carried envelopes, return-to-desk routes, idle coffee trips, typing, thinking, and human-review alerts.
- Motion preview, pause/resume, saved browser preference, and reduced-motion support.
- Pixel favicon, touch icon, studio mark, and three 512px Discord avatars. Editable artwork and a dependency-free asset builder are included.
- Visible app version and version-aware bot status.

### Workflow and controls

- Discord and web mission entry with one Manager, Researcher, and Writer.
- Gemini supplied-source analysis with structured JSON; optional Google Search grounding and offline mock mode.
- Clarification pauses for source conflicts; the corrected task replaces discarded assumptions when research resumes.
- Durable draft approval/rejection from Discord buttons, slash commands, or the local office. Approval sends the saved draft without regenerating it.
- Persistent queue, cancellation before start, review-before-retry, mission history, and usage counters.
- Server/channel/user authorization, disabled webhook mentions, and guarded state transitions to prevent duplicate approval delivery.

### Storage and development

- Private local mission records with optional Supabase mirroring and read/write verification commands.
- GitHub Actions for TypeScript checks and offline tests, plus a staged-file credential audit.
- Windows launchers, setup documentation, a copyable clarification test, and versioned source at tag `v1.0.0`.

### Scope

This release runs locally. The office polls local state; Supabase is an optional private mirror. Hosted authentication, per-user cloud authorization, Realtime subscriptions, and deployment are future milestones.
