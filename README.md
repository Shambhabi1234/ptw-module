# Permit to Work — Opmaint Web Dev Intern Assignment

A Permit to Work (PTW) module for a CMMS: authorizing hazardous work (hot
work, confined space entry, working at height, electrical isolation)
before it starts, with server-enforced approvals, a state machine, and an
immutable audit trail.

## Stack

- **Next.js 15 (App Router) + TypeScript**, full-stack — pages and API
  routes in one project.
- **PostgreSQL + Prisma** for the database and schema/migrations.
- **Zod** for request validation and for validating each permit type's
  fields.
- **jose + bcryptjs** for auth: JWT session cookie, hashed passwords. No
  OAuth, per the brief.
- **Tailwind CSS v4** for styling. No component library — the visual
  language (hazard-coded colors, a numbered paper-form layout on the
  detail page) is meant to echo an actual PTW form, not a generic admin
  dashboard.
- **Vitest** for unit tests.

## Setup

1. **Get a Postgres database.** Any free one works — Neon (neon.tech),
   Supabase (supabase.com), or Railway all have a free tier that gives
   you a `DATABASE_URL` in under a minute. Local Postgres via Docker also
   works: `docker run --name ptw-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres`.

2. **Clone and install:**
   ```bash
   npm install
   cp .env.example .env
   # edit .env: set DATABASE_URL, and set AUTH_SECRET to the output of:
   openssl rand -base64 32
   ```

3. **Create the schema and seed data:**
   ```bash
   npx prisma migrate dev --name init
   npm run db:seed
   ```

4. **Run it:**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 — you'll land on the login page.

This has been checked on a clean install; if `npm install` complains about
peer dependencies (React 19 vs. some package), add `--legacy-peer-deps`.

### Demo logins

All four seeded users use the password `password123`. The login page has
one-click buttons for these too.

| Role | Email |
|---|---|
| Requester | `requester@opmaint.demo` |
| Area Owner | `areaowner@opmaint.demo` |
| Safety Officer | `safety@opmaint.demo` |
| Admin | `admin@opmaint.demo` |

The seed script creates 2 plants, 3 areas, 6 equipment items, and 10
permits — one for every status in the lifecycle (`DRAFT` through
`CANCELLED`) — so logging in as any role shows a populated system
immediately.

### Deploying

Any Next.js host works (Vercel is the path of least resistance). Set the
same three env vars (`DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`) in the
host's dashboard, then run `npx prisma migrate deploy && npm run db:seed`
against the production database once (a `postinstall` hook already runs
`prisma generate` automatically).

## The core design decision: one Permit entity, not four forms

Every permit type shares one `Permit` table with a `type` discriminator
column and a `typeFields` JSON column. What's allowed to live inside
`typeFields` for a given type is defined **once**, in
`src/lib/permitTypes.ts`, as a Zod schema plus a small array of field
metadata (label, input kind, options) that the create-form and the
detail-view both read to render themselves generically.

Adding a fifth type — Excavation, say — means adding one entry to
`PERMIT_TYPE_REGISTRY`. No new table, no migration, no new form component,
no changes to the state machine, the permission checks, or either screen.
The Prisma schema, the API routes, and the UI don't know or care what
fields a given permit type has; they all call `getPermitTypeDef(type)`.

The trade-off: the type-specific fields aren't individually queryable/
indexable at the database level the way separate columns would be (e.g.
"find all hot work permits with LEL > 5%" would need to query the JSON,
not a column). Given the spec's own framing — the shared-entity design is
"the single biggest thing" being evaluated — this felt like the right
trade to make. If type-specific reporting became a real requirement,
Postgres's jsonb operators/indexes (`typeFields @> '{"hotWorkType":
"WELDING"}'`) cover most of it without a schema change.

## State machine

Implemented as a pure function in `src/lib/stateMachine.ts` — no Prisma,
no I/O, just `(status, action, context) -> next status | error`. Every
mutating API route calls it before writing anything, so illegal
transitions are rejected the same way whether they come from the UI or
from `curl`. 34 unit tests in `src/lib/__tests__/` cover every legal
transition, a sample of illegal ones, the "EXPIRED can never be
reactivated" rule, and that cancellation is allowed from every
non-terminal state and blocked from every terminal one (including
`CLOSED`, see below).

## Roles and permissions

Enforced server-side in `src/lib/permissions.ts`, also unit tested. The
one the spec calls out explicitly — **a person can never approve their
own permit** — is checked first, before the role/area check, in
`canActOnApproval()`, and covers area owners, safety officers, and admins
alike (an admin approving their own permit is also blocked).

## Decisions made where the spec was silent

- **Post-submission field edits.** The spec says edits after submission
  must be audit-logged, but a `DRAFT` permit is the only state where I
  allow silent field edits. Once submitted, changing a field would mean
  editing something an approver may have already signed off on — instead
  of allowing that, the flow is cancel + raise a new permit, which keeps
  the audit trail unambiguous about what exactly was approved. Documented
  as a decision, not an oversight.
- **`CLOSED` is not cancellable.** The state diagram in the spec shows
  `CANCEL` from "any non-terminal state." I read `CLOSED` as non-terminal
  (it can still move to `CLOSED_VERIFIED`), but cancelling a permit for
  work that's already finished doesn't correspond to anything real, so I
  excluded it. Tested explicitly in `stateMachine.test.ts`.
- **Who can activate.** The spec doesn't say who moves `APPROVED ->
  ACTIVE`. I gave it to the requester (they're the one physically starting
  the job) plus admin, not the approvers.
- **Safety Officer approval isn't pre-assigned to one person.** Any
  safety officer can act on the `SAFETY_OFFICER` approval slot (the area
  owner slot **is** scoped to the specific area's owner). This matches
  how a real plant works — whichever safety officer is on shift signs off,
  not a named individual.
- **Areas with no owner assigned.** One seeded area (`Assembly Line 2`)
  deliberately has no owner, to surface what happens then: right now,
  only an Admin can act on that permit's Area Owner approval slot. A real
  version of this should probably support multiple owners per area or an
  explicit escalation path — flagged under "What I'd build next."
- **Extension requests are capped** at 8 hours per request and 2 approved
  extensions per permit (`src/app/api/permits/[id]/extension/route.ts`) —
  the spec says "capped," not by how much; these are reasonable-seeming
  defaults, not domain expertise.

## Expiry — how it works when nobody has the browser open

A countdown timer in the browser doesn't expire anything by itself; it's
just a number. The actual expiry is `src/lib/expiry.ts`,
`sweepExpiredPermits()`, called from two places:

1. **Lazily**, at the top of every permit list/detail `GET` — so the UI
   is never more than one request stale even with zero other traffic.
2. **On a schedule**, via `POST /api/cron/expire` (protected by
   `CRON_SECRET` in a header), meant to be hit every few minutes by an
   external scheduler — a Vercel Cron Job, cron-job.org, or anything that
   can send an HTTP request on an interval. This is what actually expires
   a permit during a quiet hour when nobody's looking at the app.

Both call the same function, so there's exactly one definition of
"expired" in the system.

## What I'd build next

- A second Area Owner in the seed data (only one exists, since the spec
  asks for exactly 4 users / one per role) to more visibly exercise area
  scoping in the demo, beyond the unit tests.
- Multiple owners per area, and a defined escalation path for an
  ownerless area, instead of falling back to "only Admin can approve."
- QR code per permit and canvas signature capture — both in the "nice to
  have" list, both skipped in favor of finishing the core spec solidly.
- Real photo/file evidence on closure (explicitly out of scope here, but
  it's the first thing a safety officer would ask for in practice).
- Server-side pagination on the permit list — currently capped at 200
  rows, fine for a demo, not for a real plant's permit history.

## What I knowingly left broken / thin

- The mobile styling is responsive (the layout reflows, targets are
  reasonably sized) but I did not do a dedicated "gloves, sunlight,
  one-handed" pass — that's explicitly called out as a bonus item and I
  prioritized the core spec over it given the time budget.
- No websocket/live updates (explicitly out of scope) — if a safety
  officer suspends a permit, a requester looking at the same permit page
  won't see it change until they refresh or take an action that re-fetches.
- The "expiring soon" dashboard filter and countdown use a fixed 2-hour
  window, matching the spec's dashboard requirement; it isn't configurable.

## Testing

```bash
npm test
```

34 tests, all in `src/lib/__tests__/`: every legal state transition, a
sample of illegal ones hit directly (bypassing the UI, as the brief says
they'll try), the self-approval rule, and area-owner scoping. This isn't
full coverage — it's what I'd actually want caught if someone changed the
state machine or permission logic without realizing what they broke.

## On AI

I used AI (Claude) throughout this build — for scaffolding the Next.js/
Prisma project, writing the state machine and permission logic against the
rules in the spec, generating the seed data, and drafting this README. I
read and can explain every line; where the spec was silent I made the call
myself and documented it above rather than letting a default slip in
unexamined. The Loom walks through specifics.
