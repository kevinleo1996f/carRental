# Car Rental Booking API

A car rental booking backend: Node.js + Express, PostgreSQL, JWT auth, and
RabbitMQ for the one async step in the app (booking confirmation). See
[openapi.yaml](openapi.yaml) for the full API contract and
[database-schema.mmd](database-schema.mmd) for the schema.

## Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose — nothing else needs
  to be installed locally. You do **not** need Node, PostgreSQL, or
  RabbitMQ on your machine.
- A free API key from [api-ninjas.com](https://api-ninjas.com/profile) —
  needed only if you want to seed the car catalog yourself (see below).

## Setup

```bash
git clone <this-repo-url>
cd carRental
cp .env.example .env
```

Open `.env` and fill in at least:

- `JWT_SECRET` — any long random string
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — your own admin login for this app,
  there is no admin sign-up, see "Admin login" below
- `NINJA_API_KEY` — only required if you plan to run the seed script

Everything else in `.env.example` already has working defaults for local
Docker use (DB name/user/password, RabbitMQ guest/guest).

Then:

```bash
docker compose up --build
```

This starts 4 containers: `postgres`, `rabbitmq`, `api` (port `3000`), and
`worker` (no exposed port — it just consumes RabbitMQ messages in the
background). The API and worker will start even with a placeholder
`NINJA_API_KEY` — that key is only read by the seed script below.

- API: http://localhost:3000
- Swagger docs: http://localhost:3000/api-docs
- RabbitMQ management UI: http://localhost:15672 (guest / guest)

## Seeding the car catalog

Car data is **not** fetched live during a booking. It's pulled from the
Ninja API once, ahead of time, into the local `cars` table — a booking
only ever references an existing `cars` row by id. This is also the
project's backup against Ninja API downtime: once seeded, the whole app
keeps working off the local database even if api-ninjas.com is
unreachable — nothing at request time depends on it.

The free Ninja API tier only ever returns **one** car per request (its
`limit` parameter is premium-only), so the seed script loops over a curated
list of brands for each model year and makes one request per combination.
With the containers running, in a second terminal:

```bash
docker compose exec api npm run seed
```

With no flags, this seeds model years **2021–2026** across 10 common
brands (~60 requests). Pass `--year=2021` and/or `--brand=kia` to narrow
it to one year and/or one brand instead. Each run only adds new rows —
re-running it is safe and won't create duplicates for a
brand/model/year/transmission/drive combination that's already there.

If a request to Ninja fails partway through (bad key, rate limit, the
service being down), the script logs a warning for that one year/brand
and moves on — it never crashes and never touches rows it already saved,
so a flaky connection just means a smaller catalog, not a broken seed.

Two field conversions happen during seeding, not just a raw copy of
Ninja's response: `make` becomes `brand`, and `transmission` is expanded
from Ninja's single-letter code (`a`/`m`) to `automatic`/`manual`. `drive`
(`fwd`/`awd`/`rwd`/`4wd`) and `fuel_type` are stored exactly as Ninja
returns them.

## Admin login

There's no admin database row and no admin sign-up endpoint. Logging in
with the email/password from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in your
`.env` issues a JWT with `role: admin`, checked directly against those
env values — everyone else is a normal customer looked up in the
`customers` table. See `POST /auth/login` in the Swagger docs.

## Testing

- **Jest** runs unit tests against the domain/application layer (business
  rules, use cases) with no database or network involved.
- **Supertest** drives the Express app in-process for integration tests —
  e.g. `POST /bookings` really hits a (test) Postgres database and asserts
  on the real HTTP response, no server needs to be manually started.
- The Ninja API client is always mocked in tests (`jest.mock(...)`) —
  **no `NINJA_API_KEY` is required to run the test suite**, even if you
  haven't signed up for one yet. Only the seed script above uses a real
  key.

The `api`/`worker` images deliberately don't include Jest or Supertest —
they're dev-only tools, kept out of the image `docker compose up` actually
runs. To run the suite, install them into a throwaway container run:

```bash
docker compose run --rm api sh -c "npm install && npm test"
```

If you have Node installed on your own machine, `npm install && npm test`
directly on the host is faster for repeated runs while you're writing
code — same test suite either way.

## Project layout

Clean-architecture style: `domain` (entities, repository interfaces),
`application` (use cases), `infrastructure` (Postgres, RabbitMQ, the Ninja
API client, JWT/bcrypt), `interfaces/http` (Express routes, controllers,
middleware). `src/server.js` runs the API; `src/worker.js` runs the
RabbitMQ consumer as a separate process — both run in their own container
via the same Dockerfile.
