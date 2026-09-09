# horospaper

A personalized daily horoscope MVP: real astrology calculations (not LLM-guessed), an LLM-written
daily reading, and a generated "cosmic portrait" image, gated behind per-guest daily rate limits.

Astrology is provided for entertainment and personal reflection.

## Architecture

```
Astrology calculation -> Structured planetary data -> Horoscope generation (LLM) -> Image prompt -> Image generation
```

The LLM never computes planetary positions itself -- it only ever receives structured data computed
by `src/lib/astrology` (built on the [astronomy-engine](https://github.com/cosinekitty/astronomy)
ephemeris library, no external API or credentials required).

There's no account system: every visitor is an anonymous guest identified by a client-generated id
(`src/lib/client/guest.ts`, stored in localStorage). All app data -- birth profile, today's/tomorrow's
horoscope, daily usage, geocode/planetary caches -- lives in Redis with a 24-hour TTL, matching the
"one paper a day" product: nothing needs to outlive a day.

- `src/lib/astrology/` -- natal chart, today's transits, moon phase, retrogrades (astronomy-engine)
- `src/lib/geocode.ts` -- birth location -> lat/lon/timezone, via OpenStreetMap Nominatim, 24h-cached
- `src/lib/llm/` -- horoscope text generation; Anthropic or OpenAI if configured, else a deterministic
  template fallback that still weaves in the real astrology data (MOCK mode)
- `src/lib/image/` -- image prompt + generation; OpenAI images if configured, else a procedural SVG
  "cosmic portrait" generated locally (MOCK mode)
- `src/lib/storage.ts` -- saves generated image files; local `/public/generated` by default, pluggable for S3
- `src/lib/profile.ts` / `src/lib/horoscope.ts` / `src/lib/usage.ts` -- Redis-backed, 24h TTL data for
  the current guest (birth profile, today's/preview horoscope, daily generation budget)
- `src/lib/usage.ts` -- daily generation budget (today's horoscope is always free/cached; extra
  regenerations and tomorrow's preview count against `FREE_GENERATIONS_PER_DAY`)

## Getting started

```bash
cp .env.example .env           # then set UPSTASH_REDIS_REST_URL / _TOKEN
npm install
npm run dev
```

Open http://localhost:3000. No API keys are required to try the full flow -- the LLM and image
steps fall back to clearly-logged MOCK providers when `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` aren't set.

### Enabling real providers

- **LLM**: set `ANTHROPIC_API_KEY` (recommended) or `OPENAI_API_KEY`, and `LLM_PROVIDER`.
- **Images**: set `IMAGE_PROVIDER=openai` and `OPENAI_API_KEY`.

See `.env.example` for the full list.

## Tech stack

Next.js (App Router) + TypeScript + Tailwind CSS, Upstash Redis (24h TTL, guest-only, no accounts),
astronomy-engine for ephemeris math.

## Deploying

```bash
docker compose up -d --build
```

`docker-compose.yml` runs the app container; it connects to Upstash Redis via
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.


# Better half Launch
```bash
This just means that i asked my better half to  try the app
```
Findings : DB not getting connected, need to migrate to mongodb atlas

Update: MongoDB Atlas's free tier doesn't support the multi-document transactions Prisma needs, so
we tried Postgres (Neon) next -- then decided there's no need for a persistent database at all.
The app is guest-only now (no accounts) with all data stored in Upstash Redis for 24 hours, matching
the "one horoscope a day" product.
