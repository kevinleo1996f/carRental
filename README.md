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

This starts 4 containers: `postgres`, `rabbitmq`, `api` (port `3001` on
your machine — see note below), and `worker` (no exposed port — it just
consumes RabbitMQ messages in the background). The API and worker will
start even with a placeholder `NINJA_API_KEY` — that key is only read by
the seed script below.

- API: http://localhost:3001
- Test UI (customer login/homepage): http://localhost:3001/login.html
- Swagger docs: http://localhost:3001/api-docs
- RabbitMQ management UI: http://localhost:15672 (guest / guest)

The API is deliberately mapped to host port `3001`, not the more obvious
`3000` — port `3000` is a very common default for other local dev servers
(Next.js, Create React App, etc.), so mapping to `3001` avoids a collision
if you happen to have another project running. Inside Docker's internal
network the container still listens on `3000`; only the port your browser
or Postman uses to reach it is different.

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

## Test UI

A small 3-page frontend (plain HTML/JS, no build step) at `public/`,
mainly so demoing the app doesn't mean juggling Postman tabs. One login
form works for both roles — same as the real API — and redirects based
on the `role` the login response returns:

- `login.html` — log in or register.
- `index.html` — customer homepage: search a car live (shows whether the
  result came from Ninja or the database fallback), browse the cached
  catalog, book a car, and a "My bookings" table that polls every 4s.
- `admin.html` — every booking, with Approve/Reject on the pending ones.

### Demoing the async booking flow

This is the actual point of the whole project — a customer's booking
gets an instant response while a human reviews it independently, and
RabbitMQ is what carries that handoff. Follow these steps in order:

1. **Window 1 (customer)** — open `http://localhost:3001/login.html`,
   register a new account (or use one you already made), then log in.
   You land on `index.html`.
2. **Window 2 (admin)** — open `http://localhost:3001/login.html` in a
   genuinely *different* browser, or a private/incognito window (not a
   second tab in the same window/profile — `localStorage`, where the
   login token lives, is shared across tabs in one browser, and a second
   login there would silently overwrite the first session). Log in with
   the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env`. You land on
   `admin.html`.
3. In a terminal, start and leave running:
   ```bash
   docker compose logs worker -f
   ```
   This is the actual proof that RabbitMQ is doing the work — every
   booking created or approved/rejected produces a timestamped line here
   the instant it happens, independent of what either browser is doing.
4. In Window 1, search a car (e.g. brand `kia`, year `2021`) and book
   it. A `[booking.created] booking N is pending...` line appears in the
   terminal immediately.
5. In Window 2, find that booking and click **Approve**. A
   `[booking.status_changed] booking N is now "confirmed"...` line
   appears in the terminal immediately.
6. Switch back to Window 1 and don't touch anything — within about 4
   seconds, the "My bookings" table updates itself from `pending` to
   `confirmed` on its own. The customer never has to know or care when
   the queue actually delivered the message; they just see the outcome.

**A note on the RabbitMQ management UI** (`http://localhost:15672`,
guest/guest) — it's useful for confirming the `booking.created` /
`booking.status_changed` queues exist, but its "Ready"/"Unacked" counts
and rate graphs only reflect the last second or two of activity. Since
the worker consumes a message almost instantly, loading or refreshing
that page even a few seconds after clicking "Book" will correctly show
all zeros — the message already arrived and was cleared — which can
look like nothing happened even though it did. **The worker log from
step 3 is the reliable record; the RabbitMQ UI is a supplementary view,
not the proof.**

## Testing

- **Jest** runs unit tests against the domain/application layer (business
  rules, use cases) against fake repositories — no database or network
  involved, and these prove the business rules themselves (overlapping
  bookings, IDOR protection, etc.).
- **Supertest** drives the real Express app in-process for integration
  tests under `tests/integration/` — `POST /bookings`, `POST /auth/login`,
  etc. really hit Postgres and assert on the real HTTP response. These
  prove the wiring (routes → controllers → database) works, not the
  business rules a second time.
- Integration tests run against a separate **`carrental_test`** database
  on the same Postgres container — never your real `carrental` data.
  It's created automatically alongside `carrental` the first time the
  Postgres container starts against a fresh volume (see
  `create-test-db.sh`), reusing `schema.sql` so there's only one source
  of truth for the schema. Each test file truncates it before every test
  (`tests/integration/helpers/db.js`).
- `npm test` runs as `DB_NAME=carrental_test jest --runInBand` — the env
  var points the suite at the test database, and `--runInBand` runs test
  files one at a time rather than in parallel workers, since they share
  that one real database and would otherwise interfere with each other.
- The Ninja API client is mocked in the search integration test and in
  the `SearchCar` unit tests (`jest.mock(...)`) — **no `NINJA_API_KEY` is
  required to run the test suite**, even if you haven't signed up for
  one yet. Only the seed script above and manually testing `/cars/search`
  yourself use a real key.
- RabbitMQ doesn't need to be reachable for tests to pass either — booking
  creation and admin approve/reject both swallow a failed publish (see
  `CreateBooking`/`UpdateBookingStatus`), so the same resilience that
  protects production also means the test suite doesn't depend on it.

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
