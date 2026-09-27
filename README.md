# Flow Adaptive Planner

## Setup

1. Copy `.env.example` to `.env.local` and set the Supabase URL and publishable/anon key.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Set the Edge Function secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY`.
4. Deploy `supabase/functions/google-calendar/index.ts` as the `google-calendar` Edge Function.
5. Run `npm install` and `npm run dev`.

Flow uses Supabase Auth for email/password accounts and Supabase tables for all application data. Existing localStorage data is offered for one-time import after the first login, then removed.

Optional AI parsing uses `VITE_GEMINI_API_KEY`; without it, Flow uses its local heuristic parser.

Google OAuth must allow `${window.location.origin}/oauth/google/callback` as an authorized redirect URI in the Google Cloud project. The frontend only receives the authorization code; token exchange and refresh happen in the Edge Function.
