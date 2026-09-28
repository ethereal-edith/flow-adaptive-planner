# Flow — Adaptive Planner

> **⚠️ Status: personal project, pre-deployment, primarily vibe-coded.**
> This is a solo project built for personal use, not a polished or audited product. Large parts of it were built through iterative "vibe coding" with AI assistance rather than a from-scratch, fully spec'd engineering process. It has **not been deployed** anywhere yet, has no production hardening, and hasn't had a security review. Treat it as an evolving prototype — expect rough edges, incomplete error handling, and code that will keep changing shape. Use at your own risk if you clone it.

---

## What this is

Flow is an adaptive calendar/planner built around one idea: **the calendar should adapt to the human, not the other way around.**

Instead of a rigid to-do list, you brain-dump what's actually going on — deadlines, energy, exhaustion, what you haven't done — in plain language, and Flow:

1. Parses that into structured tasks + your current energy/stress state
2. Runs it through a **deterministic scheduling engine** (no LLM guessing here) that fits tasks into your real free time, around anything already on your calendar
3. Refuses to schedule things that don't fit — it tells you plainly when there isn't enough time, instead of quietly overpacking your day
4. Explains its reasoning in plain language, per task, on request

It's built specifically around ADHD-style patterns: time blindness, difficulty estimating duration, task-initiation friction, and the fact that low-energy days need a different *kind* of task, not just fewer of them.

## Core design principle: LLM recommends, engine decides

This matters enough to call out explicitly, because it's the architectural backbone of the whole app:

- The **LLM layer** (`src/ai/llmService.js`) only ever does natural-language parsing and plain-language explanation. It never touches the calendar directly.
- The **deterministic engine** (`src/engine/`) does 100% of the actual scheduling: conflict detection, energy-matching, urgency scoring, and slot placement. Every decision it makes is a pure function of its inputs — no LLM call in the loop.

This means the schedule is always reproducible, debuggable, and can't be talked into something unsafe by a weird prompt.

## What's actually built

- **Natural-language brain dump → structured tasks + energy/stress detection**, with a local heuristic parser as a fallback when no Gemini key is set (so it never hard-fails)
- **Deterministic scheduling engine** — urgency scoring, energy/cognitive-load matching, conflict detection, protected vs. flexible time blocks
- **Reality checks** — "you have 4 hours available but 7 hours of work requested" type warnings, computed, not guessed
- **Anti-stall logic** — repeatedly postponed tasks get bumped up in priority so they don't get pushed forever
- **Google Calendar sync** — read-only OAuth flow via a Supabase Edge Function; synced events are treated as protected commitments Flow will never schedule over
- **Personalized duration learning** (`src/engine/learning.js`) — logs estimated vs. actual duration per completed task and gradually adjusts per-category time multipliers (e.g. if coding tasks consistently run 1.4× over estimate, future coding blocks get sized accordingly)
- **Micro-step breakdown** — an overwhelming task can be broken into a handful of tiny, decision-free starting steps
- **Stimulation pairing suggestions** — for low-cognitive-load, repetitive tasks (chores, admin), Flow suggests pairing with music/podcasts/background audio
- **Per-task "why" explanations** — every scheduled or postponed task carries its actual scoring reasons, viewable on demand

## What's not built yet

- **True multi-turn conversation** before scheduling — right now the AI planner is single-shot (dump → parse → schedule in one pass), not a back-and-forth check-in
- **Full closed-loop learning** — outcomes are logged and duration estimates adapt, but nothing yet learns *which times of day* or *task combinations* work best for you specifically
- Production-grade auth hardening, rate limiting, and error boundaries
- Tests beyond `test/planningModule.test.js`

## Tech stack

- **Frontend:** React 19 + Vite + Tailwind CSS 4
- **Backend/data:** Supabase (Postgres + Auth + Edge Functions)
- **AI parsing (optional):** Google Gemini (`gemini-3.8-flash`) — falls back to a local heuristic parser if no key is configured
- **Calendar sync:** Google Calendar API (read-only), via a Supabase Edge Function so tokens never touch the client

## Setup

1. Copy `.env.example` to `.env.local` and set the Supabase URL and publishable/anon key.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Set the Edge Function secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY`.
4. Deploy `supabase/functions/google-calendar/index.ts` as the `google-calendar` Edge Function.
5. Run `npm install` and `npm run dev`.

Flow uses Supabase Auth for email/password accounts and Supabase tables for all application data. Existing localStorage data is offered for one-time import after the first login, then removed.

Optional AI parsing uses `VITE_GEMINI_API_KEY`; without it, Flow uses its local heuristic parser.

Google OAuth must allow `${window.location.origin}/oauth/google/callback` as an authorized redirect URI in the Google Cloud project. The frontend only receives the authorization code; token exchange and refresh happen in the Edge Function.

## Project structure

```
src/
  ai/            — LLM parsing layer (never schedules anything directly)
  engine/        — deterministic scheduling logic (planningEngine, scoring, learning, realityCheck)
  data/          — Supabase persistence + Google Calendar sync
  components/    — UI (React)
supabase/
  functions/     — Edge Functions (Google Calendar OAuth + sync)
  migrations/    — schema migrations
```

## A note on scope

This app was designed and built primarily for one person's own use, shaped around a specific way of thinking and working. Some of the underlying assumptions (protected vs. flexible events, energy-based scheduling, category duration multipliers) are generalizable, but the tone and behavior choices are tuned for a specific person, not a general audience. Fork and adapt freely — just know that's the starting point.