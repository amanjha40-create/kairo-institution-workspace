# Institution Workspace Release Readiness

Last updated: August 2, 2026

## Staging deployment

- Staging frontend hostname: `https://institution-staging.d3lrsnjzo6p8fc.amplifyapp.com`
- Hosting platform: AWS Amplify Hosting (`appId: d3lrsnjzo6p8fc`, branch: `staging`)
- Backend hostname: `https://staging-api.kairoid.com`
- Backend revision: `7a93ac20f33dc39161ddb461eb6b040e6c055c70`
- Backend rollout reference: `kairo-staging-backend:72`
- Alembic revision: `062`
- Frontend branch: `codex/institution-v1-release-completion`

## Completed Version 1 frontend capabilities

- Real institution login, logout, refresh, workspace bootstrap, and protected-route redirect behavior
- Backend-driven institution signup onboarding with shared organization staff signup and email OTP contract
- Backend-driven institution dashboard
- Backend-driven team members, invitations, role changes, suspension, restoration, removal, and ownership transfer
- Backend-driven verification inbox and request detail
- Backend-driven verification actions for reviewer assignment, internal notes, clarification, verify, reject, cancel, and priority updates
- Backend-driven people directory, person detail, credential history, verification history, and authoritative passport summary
- Backend-driven institution settings, account profile, notifications, sessions, and password reset completion flow
- AWS Amplify SSR build target using Nitro `aws_amplify`
- Production bundle isolation from demo fixtures, sample-token preview links, and Lovable runtime artifacts

## Repository finalization completed

- Removed obsolete Lovable metadata from the tracked repository
- Removed the unused Lovable runtime error-reporting helper
- Removed the demo-only signup preview helper and sample-token preview entry points from the runtime UI
- Kept demo behavior behind explicit compile-time gating only
- Corrected verification detail mapping so unsupported candidate-claim fields remain unavailable instead of being synthesized from institution records

## Local validation results

Validated on August 2, 2026:

- `npm run typecheck` passed
- `npx vitest run --configLoader runner` passed
- `npx prettier --check .` passed
- `npm run lint` completed with the pre-existing seven `react-refresh/only-export-components` warnings only
- `VITE_APP_ENV=production VITE_API_BASE_URL=https://api.kairoid.com VITE_DEMO_MODE=false NITRO_PRESET=aws_amplify npm run build` passed
- `VITE_APP_ENV=staging VITE_API_BASE_URL=https://staging-api.kairoid.com VITE_DEMO_MODE=false NITRO_PRESET=aws_amplify npm run build` passed

## Live staging checks completed

Validated against the staging frontend on August 2, 2026:

- Public institution landing page loads successfully
- Protected route access to `/institution/verifications` redirects to `/institution/login?redirect=%2Finstitution%2Fverifications`
- Login page renders successfully from the live deployment
- No browser console warnings or errors were captured on the public landing or protected redirect/login flow
- The staging deployment remains pointed at the staging backend host, not production

## Remaining known limitations

- Full authenticated staging acceptance is still blocked because this repository does not include a reusable staging institution credential set or mailbox access for completing the real signup OTP, login, dashboard, people, verification, team, settings, and session flows end to end.
- Institution public magic-link verification remains intentionally fail-closed until the approved backend contract is available for this workspace.
- ESLint still reports seven narrow `react-refresh/only-export-components` warnings in shared UI/auth files that were previously accepted as non-blocking and were not broadened by this finalization pass.

## Production confirmation

- Production-mode builds require an explicit HTTPS `VITE_API_BASE_URL`
- Demo mode remains disabled unless `VITE_DEMO_MODE=true` is set at build time
- The latest Amplify build artifact does not expose `mock-data`, `demo-password`, `valid-token`, `__lovable`, or `lovable` strings
- This frontend is release-ready pending successful authenticated staging acceptance and the remaining backend-dependent magic-link support
