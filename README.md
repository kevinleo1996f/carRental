 # Car Rental Booking API

A car rental booking backend: Node.js + Express, PostgreSQL, JWT auth, and
RabbitMQ for the one async step in the app (booking confirmation). See
[openapi.yaml](openapi.yaml) for the full API contract and
[database-schema.mmd](database-schema.mmd) for the schema. If you're
checking this against a specific requirements list, jump straight to
[**Requirements checklist**](#requirements-checklist) at the bottom —
every item there links back to how to test it yourself.

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
docker compose up --build
```

That's it — **no `.env` file is required.** `docker-compose.yml` bakes in
a safe, local-only default for every environment variable the app needs
(JWT secret, admin login, DB/RabbitMQ credentials, CORS origin), so a
completely bare clone works immediately. This starts 4 containers:
`postgres`, `rabbitmq`, `api` (port `3001` on your machine — see note
below), and `worker` (no exposed port — it just consumes RabbitMQ
messages in the background). The database comes pre-loaded with a
handful of demo cars, a demo customer, and a demo booking (see "Seeding"
below) — there's something to look at immediately, not an empty database.

If you want to override any default — a real `NINJA_API_KEY` so
`/cars/search` actually hits Ninja, your own `JWT_SECRET`, a different
admin login — copy `.env.example` to `.env` and fill in only the ones
you care about; anything you don't set keeps its built-in default:

```bash
cp .env.example .env
```

`.env` is gitignored, so anything you put there never leaves your
machine.

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

A fresh volume already has 5 baseline cars (`seed-data.sql`, applied
automatically alongside the schema), plus a demo account —
`demo@carrental.local` / `demopass123` — with one demo booking, so
`GET /cars`, `GET /bookings`, and `GET /admin/bookings` all have
something real to return with zero manual steps. `npm run seed` (below)
adds real, Ninja-sourced cars on top of these — it never removes or
duplicates them.

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

## Proving the Ninja fallback (`GET /cars/search`)

Unlike browsing the catalog, `GET /cars/search?brand=&year=` calls Ninja
**live**, with the local database only as a backup if Ninja is
unreachable. `SearchCar` (`src/application/use-cases/SearchCar.js`)
falls back on any failure — a thrown error *or* a timeout (5s, via
`AbortController`) *or* one retry also failing — and the response always
names which source actually answered:

```json
{ "source": "ninja_api", "car": { ... } }
{ "source": "database_fallback", "car": { ... } }
```

To see the fallback fire for real:

1. Search a car normally (with a real `NINJA_API_KEY` set) → `source: "ninja_api"`.
2. Break the key: open `.env`, change one character in `NINJA_API_KEY`
   (create `.env` from `.env.example` first if you don't have one —
   this demo specifically needs to go from a *working* key to a *broken*
   one, so the zero-config default alone won't show the transition).
3. `docker compose up -d --build api` to pick up the change.
4. Search the **same** brand/year again → `source: "database_fallback"`,
   since it was already cached from step 1 (or is one of the baseline
   seed cars). The `api` container's own logs
   (`docker compose logs api`) show exactly why:
   `Ninja API search failed for brand=... year=...: ... -- falling back to the local database.`
5. Restore the real key, rebuild, search again → back to `"ninja_api"`.

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

- **Jest** is the test framework — every single test in this project
  runs under it, no exceptions. It runs unit tests against the
  domain/application layer (business rules, use cases) against fake
  repositories — no database or network involved, and these prove the
  business rules themselves (overlapping bookings, IDOR protection, etc.).
- **Supertest** is not an alternative to Jest — it's a small library used
  *inside* some Jest tests (everything under `tests/integration/`) to
  drive real HTTP requests at the real Express app (`request(app).post('/auth/login')...`),
  hitting real Postgres and asserting on the real HTTP response. These
  prove the wiring (routes → controllers → database) works, not the
  business rules a second time.

**To see the difference live, not just read about it**: stop Postgres
(`docker compose stop postgres`), then run only the unit tests —
`npx jest --runInBand tests/application tests/domain tests/infrastructure`
— they pass instantly, no database needed. Then run only the integration
tests the same way (`DB_HOST=localhost DB_PORT=5433 npm run test:integration:local`)
— every one fails immediately with a connection error. Same test
framework, wildly different dependency on infrastructure — that
contrast is the clearest proof of the distinction there is. Restart
Postgres (`docker compose start postgres`) afterward.
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

There is only ever **one** Postgres, and it always runs in a Docker
container — the choice below is about where your *Jest process itself*
runs, not about which database it talks to. That's why every script
below comes in two forms.

**Recommended: run directly on your machine (needs Node installed).**
Everything runs one command at a time, no throwaway container per run:

```bash
docker compose up -d              # Postgres (and friends) must already be running
npm install
npm run test:local                # full suite
npm run test:integration:local    # only the Supertest suite under tests/integration/
npm run test:coverage:local       # full suite + coverage report
```

These use `DB_HOST=localhost` / `DB_PORT=5433` instead of `.env`'s
defaults. Jest running directly on your machine sits *outside* Docker's
internal network, so it reaches the same Postgres container the way any
other host tool does (`5433`, same as pgAdmin needed earlier) — `.env`'s
own `DB_HOST=localhost` / `DB_PORT=5432` are written for the *other*
case below, where they're correct instead.

**Alternative: fully inside Docker** (what a teammate with only Docker
installed, no Node, would use — also how CI would run this):

```bash
docker compose run --rm api sh -c "npm install && npm test"
docker compose run --rm api sh -c "npm install && npm run test:integration"
docker compose run --rm api sh -c "npm install && npm run test:coverage"
```

Here the test process runs *inside* a container on the same Docker
network as `postgres`, so it can reach it by container name instead of
by host port — `docker-compose.yml` overrides `DB_HOST` to `postgres`
for exactly this case, and `.env`'s own `DB_PORT=5432` is already
correct too (that's the container-internal port). No `:local` suffix
needed here.

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

## Requirements checklist

Every item below has actually been run and verified against this
codebase, not assumed. Anything not fully met is marked and explained
rather than glossed over.

### Platform and operations

- ✅ **One-command start** — `docker compose up` brings up the whole
  stack with **zero setup**, no `.env` required (see Setup above).
  Test it yourself: `mv .env .env.bak 2>/dev/null; docker compose up -d`
  → all 4 containers healthy (`docker compose ps`); restore afterward
  with `mv .env.bak .env`.
- ✅ **Health endpoint** — `GET /health` actually checks Postgres
  (`SELECT 1`) and RabbitMQ (opens/reuses the real connection) on every
  call, not a static "yes I'm up." Test: `curl localhost:3001/health`
  → `{"status":"ok","dependencies":{"postgres":"ok","rabbitmq":"ok"}}`.
  Then `docker compose stop postgres && curl localhost:3001/health` →
  `503` naming exactly which dependency is down; `docker compose start postgres`
  to restore it.

### API and data layer

- ✅ **API layer runs** — Node + Express (plain JS). Test: `docker compose up`,
  `curl localhost:3001/health`.
- ✅ **GET collection → array (200)** — e.g. `GET /cars`, `GET /admin/bookings`.
- ✅ **GET single → one record (200/404)** — e.g. `GET /cars/:id`, `GET /bookings/:id`.
- ✅ **POST create (201)** — `POST /auth/register` returns `201`. **One
  deliberate exception**: `POST /bookings` returns `202 Accepted`, not
  `201` — intentional, not a miss. The entire point of this project is
  that booking creation is asynchronous (customer gets an instant
  response, a human reviews independently); `202` is the status code
  that specifically means "accepted, not yet finished," which is a more
  accurate description than `201` for this one endpoint.
- ✅ **PUT replace → full update (200/404)** — `PUT /admin/cars/:id`,
  requires every field, added specifically for this requirement. Test:
  `curl -X PUT localhost:3001/admin/cars/1 -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"brand":"kia","model":"x","fuel_type":"gas","transmission":"manual","year":2024,"drive":"awd"}'`.
- ✅ **PATCH update → partial (200)** — `PATCH /admin/bookings/:id/approve` / `/reject`.
- ✅ **DELETE remove (204)** — `DELETE /admin/cars/:id`.

### Database layer

- ✅ **Database running** — Postgres, via Docker.
- ✅ **Schema designed** — [`schema.sql`](src/infrastructure/db/schema.sql):
  3 tables, typed columns, primary keys.
- ✅ **Relationships modelled** — `bookings.customer_id → customers.id`,
  `bookings.car_id → cars.id`, both real foreign keys, not just
  documented — proven back when a delete of a referenced car was
  actually rejected by Postgres itself, not application code.
- ✅ **Seed data** — [`seed-data.sql`](src/infrastructure/db/seed-data.sql),
  applied automatically on a fresh volume: 5 cars, 1 demo customer
  (`demo@carrental.local` / `demopass123`), 1 demo booking — enough to
  demo every endpoint immediately. `npm run seed` adds real
  Ninja-sourced cars on top whenever you want more.

### CORS, security, docs

- ✅ **CORS** — restricted to exactly one allowed origin (`CORS_ORIGIN`,
  `http://localhost:3002` by default) rather than open to `*`. This was
  a deliberate choice: a wildcard only ever proves "everyone is let
  in," while a real allow-list proves an actual restriction is being
  enforced. All verbs used by this API (GET/POST/PUT/PATCH/DELETE) work
  correctly from the allowed origin; every other origin is genuinely
  rejected by the browser. See "Proving CORS is actually working" above
  for the full live demo, including `npm run demo:cors:allowed` /
  `demo:cors:blocked`.
- ✅ **Pre-flight** — proven with both a real browser (Chrome's own
  console shows the rejection verbatim for a disallowed origin) and via
  curl (`OPTIONS` + `Origin` header → `204` + the CORS header for the
  allowed origin, no header at all for any other).
- ✅ **Authentication** — `POST /auth/login` issues a JWT.
- ✅ **Authorisation** — protected routes reject without a token (`401`)
  and with the wrong role (`403`). Test: `curl localhost:3001/bookings`
  (no header) → `401`; log in as a customer and try
  `curl -X DELETE localhost:3001/admin/cars/1 -H "Authorization: Bearer $CUSTOMER_TOKEN"` → `403`.
- ✅ **Swagger docs** — `/api-docs`, live, all 13 paths listed (audited
  against the actual Express routes as part of this pass — `GET /auth/me`
  and `GET /health` had been missing from the spec until now, fixed
  alongside this checklist).
- ✅ **Docs validated** — every documented route has actually been hit
  against the running API throughout this project (curl, Postman,
  Supertest), not just written and assumed correct.
- ⚠️ **Submission pack** — README ✅, exported Postman collection ✅
  ([`carRental.postman_collection.json`](carRental.postman_collection.json),
  generated from the OpenAPI spec itself via Postman's own converter, so
  it can't drift from the real contract — includes a `{{baseUrl}}`
  variable already set to `http://localhost:3001` and collection-level
  bearer auth). **Screenshots — not included.** Which moments to
  capture for a submission is a judgment call for you to make, not
  something to fabricate on your behalf.

### Domain and architecture

- ✅ **Domain modules split** — `Customer` / `Car` / `Booking`.
- ✅ **Controllers stay thin** — routing/HTTP only; see any controller,
  e.g. [`carsController.js`](src/interfaces/http/controllers/carsController.js).
- ✅ **Service layer** — [`application/use-cases/`](src/application/use-cases) —
  zero Express imports anywhere in that folder.
- ✅ **Repository layer** — [`domain/repositories/`](src/domain/repositories)
  interfaces + [`infrastructure/db/repositories/`](src/infrastructure/db/repositories)
  implementations; nothing outside `infrastructure/` imports `pg` directly.
- ✅ **Request validation** — checked on entry, `400` with a specific
  message (e.g. `"brand and year are both required to search."`) — hand-written
  checks rather than a schema library like Joi/Zod, which is a
  deliberate choice for a project this size: a validation library would
  be one more dependency and one more thing to configure for a handful
  of straightforward presence/type checks.
- ✅ **Central error handler** — one [`errorHandler`](src/interfaces/http/middlewares/errorHandler.js)
  middleware, the same `{message}` shape everywhere.
- ✅ **Migrations and seed** *(Optional)* — `schema.sql` + `seed-data.sql`
  via Postgres's own init mechanism; the whole database rebuilds from
  nothing with one `docker compose up`.

### Testing and quality

- ✅ **Jest runs.**
- ✅ **Unit tests** — the `application/use-cases` layer, tested against
  fake repositories (see "Testing" above — includes a live demo of the
  unit-vs-integration distinction by stopping Postgres and watching one
  suite keep passing while the other fails).
- ✅ **Integration tests** — Supertest hits real routes against real
  Postgres, under [`tests/integration/`](tests/integration).
- ✅ **Test data** — every integration test file truncates the test
  database in `beforeEach`; no test depends on another's leftover state.
- ✅ **Coverage gate** — `jest.config.js`'s `coverageThreshold` (80% on
  all four metrics) makes `npm run test:coverage` **exit non-zero** if
  coverage regresses below the bar — proven to actually fire (not just
  configured) by temporarily setting an impossible 99% threshold and
  watching it fail with a specific message, then restoring it.

### Async work and integrations

- ✅ **RabbitMQ running** — broker up, management UI reachable at
  `http://localhost:15672`.
- ✅ **Publisher** — `CreateBooking` / `UpdateBookingStatus` publish an
  event instead of doing anything slow inline.
- ✅ **Consumer** — [`worker.js`](src/worker.js), a separate process/container.
- ✅ **External API client** — [`ninjaApiClient.js`](src/infrastructure/external/ninjaApiClient.js),
  one third party (api-ninjas.com), called over HTTPS.
- ✅ **Resilience** — all three explicitly present: a 5-second timeout
  via `AbortController` (so a hung request can't block the fallback
  path), one retry before giving up, and a database fallback when Ninja
  still isn't available after that. See "Proving the Ninja fallback"
  earlier in this README for the live demo (break `NINJA_API_KEY`,
  watch `source` flip to `database_fallback`).
- ✅ **Secrets** — every credential is an environment variable; `.env`
  is gitignored; only `.env.example` (placeholders) and
  `docker-compose.yml` (safe local-only defaults) are committed.
