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

### Proving CORS is actually working

The API only allows one specific browser origin — `CORS_ORIGIN` in
`.env`, `http://localhost:3002` by default — not `*` (any origin).
Requests with no `Origin` header at all (curl, Postman) are unaffected
either way, since CORS is purely a browser mechanism.

The pages above are served by the same Express app as the API, so
they're same-origin — the browser never applies CORS to a same-origin
request, meaning using them normally proves nothing about CORS
specifically, even though everything works. Proving it means serving
the same pages from a real, different origin and showing **both** the
allowed case and the blocked case — a wildcard would only ever show
"it lets everyone in," which isn't actually a demonstration of
restriction.

```bash
npm run demo:cors:allowed   # serves public/ on :3002 — the allowed origin
npm run demo:cors:blocked   # serves public/ on :8080 — a different, disallowed origin
```

Both run on your host machine (not in Docker); your API keeps running
on `3001` as usual.

**Allowed:** open `http://localhost:3002/login.html?apiBase=http://localhost:3001`
and log in normally — it works exactly like same-origin use. You only
need to type `?apiBase=...` once; it's remembered in `sessionStorage`
and survives the redirect to `index.html` / `admin.html`.

**Blocked:** open `http://localhost:8080/login.html?apiBase=http://localhost:3001`
instead and try to log in — it fails. Open DevTools → Console first and
you'll see Chrome's own message:
```
Access to fetch at 'http://localhost:3001/auth/login' from origin
'http://localhost:8080' has been blocked by CORS policy: Response to
preflight request doesn't pass access control check: No
'Access-Control-Allow-Origin' header is present on the requested resource.
```
That's the browser itself refusing to let the page read the response —
this is the actual mechanism, not a simulation of it.

**Or skip the browser entirely, and see the same contrast via curl:**
```bash
# allowed origin -> 204 with a specific Access-Control-Allow-Origin
curl -i -X OPTIONS http://localhost:3001/cars \
  -H "Origin: http://localhost:3002" -H "Access-Control-Request-Method: GET"

# any other origin -> rejected, no Access-Control-Allow-Origin header at all
curl -i -X OPTIONS http://localhost:3001/cars \
  -H "Origin: http://localhost:8080" -H "Access-Control-Request-Method: GET"

# no Origin header at all (how curl/Postman normally behave) -> still works fine
curl -i http://localhost:3001/health
```

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

**If you have Node installed on your own machine** and want to run
`npm test` directly on the host instead (faster for repeated runs while
writing code), the plain command will fail — `.env`'s `DB_HOST=localhost`
/ `DB_PORT=5432` are tuned for *inside* Docker, where they correctly
reach the `postgres` container's internal port. From the host, Postgres
is actually reachable at `localhost:5433` (see the port note earlier in
this README), so use this instead:

```bash
npm run test:local
```

which is just `npm test` with `DB_HOST`/`DB_PORT` pointed at `5433`
instead of `.env`'s Docker-internal values — same test suite, same
database, run from outside the container.

**Other useful variants** — each has a `:local` counterpart with the same
`DB_HOST`/`DB_PORT` fix already baked in, so there's nothing to remember
or type by hand:

```bash
npm run test:integration          # only the Supertest suite, via Docker
npm run test:integration:local    # same, run directly on the host
npm run test:coverage             # full suite + coverage report, via Docker
npm run test:coverage:local       # same, run directly on the host
```

`test:coverage` prints a percentage table straight to the terminal
(statements/branches/functions/lines, overall and per file) and also
writes a browsable report to `coverage/lcov-report/index.html` — open
that file directly in a browser for a clickable, line-by-line view of
exactly what is and isn't covered. `coverage/` is gitignored, generated
fresh each run.

`jest.config.js` excludes a few files from the percentage on purpose,
not to inflate the number but because they're categorically not the
kind of thing a unit/integration test suite is the right tool for:
`src/domain/repositories/**` (abstract interfaces — every method just
throws `Not implemented`; only the concrete `Postgres*Repository`
subclasses, which override every method, are ever actually called), and
`src/server.js` / `src/worker.js` / `src/scripts/**` (process
entrypoints — verified throughout this project by actually running them
in Docker, not by importing and unit-testing a `.listen()` call). With
those excluded, current coverage is in the 90%+ range on statements,
functions, and lines, and comfortably above 80% on branches — the
remaining gaps are individually small and specific (a few environment
variable default-value fallbacks, one hard-to-trigger database error
passthrough), not broad holes.

## Project layout

Clean-architecture style: `domain` (entities, repository interfaces),
`application` (use cases), `infrastructure` (Postgres, RabbitMQ, the Ninja
API client, JWT/bcrypt), `interfaces/http` (Express routes, controllers,
middleware). `src/server.js` runs the API; `src/worker.js` runs the
RabbitMQ consumer as a separate process — both run in their own container
via the same Dockerfile.
