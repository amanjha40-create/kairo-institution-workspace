# Kairo Institution Trust Workspace

The Kairo Institution Trust Workspace is a standalone TanStack Start, React, TypeScript, Tailwind, TanStack Query, and Zod frontend for educational institutions that need to respond to education verification requests, compare candidate-submitted claims with institution records, manage institution staff, and handle secure one-time verification links.

## Product scope

This workspace is for universities, colleges, schools, training institutions, and certification bodies that need portable professional trust infrastructure.

It is not:

- an alumni CRM
- a university ERP
- a placement portal
- an event platform
- a student information system
- an analytics product

## Locked routes

Public routes:

- `/institution`
- `/institution/login`
- `/institution/signup`
- `/institution/signup/institution`
- `/institution/signup/admin`
- `/institution/signup/verify`
- `/institution/signup/review`
- `/institution/signup/success`
- `/institution/verify/:token`

Protected routes:

- `/institution/verifications`
- `/institution/verifications/:requestId`
- `/institution/people`
- `/institution/people/:personId`
- `/institution/team`
- `/institution/settings`

Verification Requests remains the default protected landing page.

## Navigation

The protected workspace intentionally keeps exactly four primary navigation items:

- Verification Requests
- People
- Team
- Settings

## Architecture

The app keeps institution-specific logic under [`src/lib/institution`](/Users/Aman/Documents/New project/kairo-institution-workspace/src/lib/institution).

Key pieces:

- `config.ts`: public environment parsing and mode validation
- `auth.tsx`: typed institution auth adapter and session provider
- `api.ts`: typed repositories/adapters for demo data and future backend integration
- `signup.ts`: signup draft handling with sensitive fields kept out of browser persistence
- `permissions.ts`: central frontend permission model for `owner`, `admin`, and `reviewer`
- `query-keys.ts`: shared TanStack Query keys
- `errors.ts`: normalized frontend error semantics

## Operating modes

### Production mode

Production mode is the default when `VITE_DEMO_MODE=false`.

Current behavior:

- no mock authentication
- no hardcoded sign-in success
- no demo session creation
- no passwords or OTP-like codes in persistent browser storage
- no hidden fallback to local fixture data
- fail-closed behavior when institution APIs are unavailable

Because approved institution APIs are not implemented yet, production mode currently shows honest unavailable states for protected institution data and write actions instead of pretending persistence exists.

### Demo mode

Enable demo mode explicitly with:

```bash
VITE_DEMO_MODE=true
```

When enabled:

- fixture-backed institution data is available
- demo login works only for known Northbridge University fixture accounts
- demo password is required
- magic-link responses mutate in-memory fixtures for the current browser session
- the UI shows a Demo Mode badge
- no real network calls are required

## Environment variables

See [`.env.example`](/Users/Aman/Documents/New project/kairo-institution-workspace/.env.example).

Approved keys:

- `VITE_APP_ENV`
- `VITE_DEMO_MODE`
- `VITE_API_BASE_URL`
- `VITE_ERROR_REPORTING_DSN`

## Package manager

The repository includes a `bun.lock`, so Bun is the intended package manager for normal development and CI.

```bash
bun install
bun run dev
```

If Bun is unavailable locally, `npm` can be used temporarily for one-off validation without committing a lockfile, but that is a local environment fallback rather than a repository migration.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run build:dev`
- `npm run preview`
- `npm run typecheck`
- `npm run lint`
- `npm run format`
- `npm run format:check`
- `npm run test`

The same script names work with `bun run ...` when Bun is installed.

## Testing

Focused Vitest coverage lives under [`src/test`](/Users/Aman/Documents/New project/kairo-institution-workspace/src/test).

Current tests target:

- protected-route redirects
- public-route access
- demo mode gating
- secure signup draft persistence
- auth/session safeguards
- consented professional information display rules
- reviewer permission restrictions
- final active Owner protection
- magic-link state handling
- public response mutation behavior
- request-detail labeling for claim versus institution record

## Build and deployment assumptions

The app still uses [`@lovable.dev/vite-tanstack-config`](https://www.npmjs.com/package/@lovable.dev/vite-tanstack-config) and TanStack Start.

Important implications:

- the Lovable Vite config currently drives TanStack Start, Tailwind, path aliases, and Nitro integration
- `src/server.ts` is the SSR entrypoint
- the Lovable config comment indicates Nitro defaults to a Cloudflare target during build
- that makes Cloudflare Workers or another Nitro-compatible target the safest current deployment assumption until the hosting target is explicitly revalidated

Do not remove Lovable metadata or replace the build config blindly. First verify the chosen deployment environment supports the TanStack Start plus Nitro output this repository generates.

## Backend dependency status

Institution-specific production APIs are not approved yet.

This frontend still requires backend contracts for:

- institution signup and approval
- institution authentication and session refresh
- password reset
- verification request list/detail and mutations
- team and settings management
- people and consent-filtered professional information
- public magic-link lookup and response submission
- audit events and evidence authorization

See [`docs/institution-api-contract.md`](/Users/Aman/Documents/New project/kairo-institution-workspace/docs/institution-api-contract.md).

## Security limitations until backend integration

The frontend should not be considered production-ready yet even if the build passes.

Remaining blockers include:

- real institution authentication and server session enforcement
- backend authorization for every role-sensitive action
- persistent verification and team mutations
- audit logging
- approved institution API endpoints
- expiring evidence URLs and token hashing

## Local setup

```bash
cp .env.example .env
bun install
bun run dev
```

With npm fallback:

```bash
cp .env.example .env
npm install --no-package-lock
npm run dev
```
