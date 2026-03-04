# 001 MVP — Quickstart

## Prerequisites
- Node.js (LTS)
- pnpm (or npm)
- Supabase CLI
- Expo CLI (via `npx expo`)
- A Supabase project created (dev)
- TMDB API token available (server-side secret)

## Environment variables
### Mobile (client)
Create `apps/mobile/.env` from `apps/mobile/.env.example`:
- EXPO_PUBLIC_SUPABASE_URL=...
- EXPO_PUBLIC_SUPABASE_ANON_KEY=...

### Supabase Edge Functions (server)
Configure secrets in Supabase:
- TMDB_API_TOKEN=...

Do NOT put service role key into mobile env.

## Local Supabase (recommended for dev)
1) `cd supabase`
2) `supabase start`
3) Apply migrations:
   - `supabase db reset` (or `supabase migration up` depending on your workflow)

4) Serve functions locally (depending on CLI version):
   - `supabase functions serve`

## Mobile app
1) `cd apps/mobile`
2) Install deps:
   - `pnpm i` (or `npm i`)
3) Run:
   - `pnpm expo start`

## Smoke test (manual)
1) Launch app on two devices/simulators
2) Create room on device A
3) Join on device B via code
4) Set preferences on both
5) Verify both show same movie card
6) Like on both -> match appears