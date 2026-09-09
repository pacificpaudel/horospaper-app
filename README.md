# horospaper

A personalized daily horoscope MVP: real astrology calculations (not LLM-guessed), an LLM-written
daily reading, and a generated "cosmic portrait" image, gated behind per-user daily rate limits.

Astrology is provided for entertainment and personal reflection.

## Architecture

```
Astrology calculation -> Structured planetary data -> Horoscope generation (LLM) -> Image prompt -> Image generation
```

The LLM never computes planetary positions itself -- it only ever receives structured data computed
by `src/lib/astrology` (built on the [astronomy-engine](https://github.com/cosinekitty/astronomy)
ephemeris library, no external API or credentials required).

- `src/lib/astrology/` -- natal chart, today's transits, moon phase, retrogrades (astronomy-engine)
- `src/lib/geocode.ts` -- birth location -> lat/lon/timezone, via OpenStreetMap Nominatim, DB-cached
- `src/lib/llm/` -- horoscope text generation; Anthropic or OpenAI if configured, else a deterministic
  template fallback that still weaves in the real astrology data (MOCK mode)
- `src/lib/image/` -- image prompt + generation; OpenAI images if configured, else a procedural SVG
  "cosmic portrait" generated locally (MOCK mode)
- `src/lib/storage.ts` -- saves generated images; local `/public/generated` by default, pluggable for S3
- `src/lib/usage.ts` -- daily generation budget (today's horoscope is always free/cached; extra
  regenerations and tomorrow's preview count against `FREE_GENERATIONS_PER_DAY`)

## Getting started

```bash
cp .env.example .env
docker compose up -d db        # local Postgres
npm install
npx prisma migrate dev         # creates the schema
npm run dev
```

Open http://localhost:3000. No API keys are required to try the full flow -- the LLM and image
steps fall back to clearly-logged MOCK providers when `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` aren't set.

### Enabling real providers

- **LLM**: set `ANTHROPIC_API_KEY` (recommended) or `OPENAI_API_KEY`, and `LLM_PROVIDER`.
- **Images**: set `IMAGE_PROVIDER=openai` and `OPENAI_API_KEY`.
- **Google sign-in**: set `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (the button hides itself otherwise).

See `.env.example` for the full list.

### Admin access

There's no self-serve admin promotion in this MVP. Promote a user after they've registered:

```sql
UPDATE "User" SET role = 'admin' WHERE email = 'you@example.com';
```

Then sign out and back in (the admin role is embedded in the session JWT), and visit `/admin`.

## Tech stack

Next.js (App Router) + TypeScript + Tailwind CSS, PostgreSQL + Prisma ORM, Auth.js v5
(guest / email+password / Google), astronomy-engine for ephemeris math.

## Deploying

```bash
docker compose up -d --build
```

`docker-compose.yml` runs Postgres and the app; the app container runs `prisma migrate deploy`
on startup before starting the server.


# Better half Launch
```bash
This just means that i asked my better half to  try the app
```
Findings : DB not getting connected, need to migrate to mongodb atlas

