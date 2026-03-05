# Otteroom Supabase

Supabase backend for the Otteroom MVP, including database migrations and Edge Functions.

## Prerequisites

- Supabase CLI
- Node.js (LTS)
- pnpm (or npm)

## Local Development

### 1. Start Supabase Locally

```bash
cd supabase
supabase start
```

This starts a local Supabase instance with PostgreSQL, PostgreSQL REST API, Realtime, and other services.

### 2. Apply Migrations

```bash
supabase db reset
# or, if you prefer incremental migrations:
supabase migration up
```

### 3. Set Environment Variables

For local development, configure secrets:

```bash
supabase secrets set TMDB_API_TOKEN=your-token
```

### 4. Serve Edge Functions Locally

```bash
supabase functions serve
```

This starts a local server for testing Edge Functions. They will be available at `http://localhost:54321/functions/v1/<function-name>`.

## Project Structure

- `migrations/` — SQL migration files for database schema
- `functions/` — Supabase Edge Functions (TypeScript running on Deno)
- `seed.sql` — Optional seed file for development data
- `config.toml` — Supabase project configuration

## Migrations

All database migrations live in `migrations/`. To create a new migration:

```bash
supabase migration new <migration_name>
```

Then edit the generated file in `migrations/` and apply with:

```bash
supabase migration up
```

## Edge Functions

Each Edge Function is a TypeScript file in `functions/<function-name>/index.ts`. Examples:

- `functions/create-room/index.ts` — Create a new room
- `functions/join-room/index.ts` — Join an existing room
- `functions/set-preferences/index.ts` — Set user preferences
- `functions/seed-queue/index.ts` — Seed movie queue
- `functions/vote/index.ts` — Cast a vote on a movie

### Testing Edge Functions Locally

1. Start Supabase: `supabase start`
2. Serve functions: `supabase functions serve`
3. Call a function:

```bash
curl -X POST http://localhost:54321/functions/v1/create-room \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"language":"en"}'
```

## Deployment

### Deploy Migrations

```bash
supabase migration up --linked
```

### Deploy Edge Functions

```bash
supabase functions deploy
```

Or deploy a specific function:

```bash
supabase functions deploy <function-name>
```

## Documentation

See `.specify/specs/001-mvp-mobile-core/` for:
- `data-model.md` — Database schema and constraints
- `contracts/edge-functions.md` — Edge Function request/response contracts
- `contracts/realtime.md` — Realtime subscription contract
- `quickstart.md` — Full setup guide
