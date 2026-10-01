# PatientFlow Authenticated Smoke And Security Upgrade Plan

This plan is intentionally separated from production deploy. It prepares the
security upgrade path and the authenticated smoke gate needed before another
live release.

## Current Status

- Public live smoke passes for the primary production app:
  - `https://patientflow.crea8ivmedia.com`
- Legacy or clinic-branded domains should be checked separately after DNS/SSL
  redirect is confirmed.
- Non-breaking `npm audit fix` has already reduced advisories.
- Remaining production advisories are React Router major-version fixes.
- Remaining dev/build advisories are Vite/esbuild major-version fixes.

Current latest package targets checked from npm:

- `react-router-dom@7.18.2`
- `vite@8.2.2`

## Authenticated Smoke Gate

Run public checks:

```bash
npm run smoke:patientflow:public
```

Run one authenticated account:

```bash
PF_SMOKE_EMAIL="admin@example.com" \
PF_SMOKE_PASSWORD="..." \
npm run smoke:patientflow
```

Run both superadmin and clinic owner accounts:

```bash
PF_SMOKE_ADMIN_EMAIL="admin@example.com" \
PF_SMOKE_ADMIN_PASSWORD="..." \
PF_SMOKE_OWNER_EMAIL="owner@example.com" \
PF_SMOKE_OWNER_PASSWORD="..." \
PF_SMOKE_REQUIRE_AUTH=true \
npm run smoke:patientflow
```

The smoke script never prints passwords. It verifies:

- Public SPA routes.
- Node health.
- Proxied API health.
- CORS preflight.
- Superadmin read-only endpoints.
- Clinic owner read-only endpoints.

## Security Upgrade Sequence

1. Create a local compatibility branch.
2. Upgrade React Router first:
   - `react-router-dom@7.18.2`
   - verify imports, routing, basename, redirects, nested routes, and lazy routes.
3. Run:
   - `npm run build:node-root`
   - `npm run smoke:patientflow:public`
   - authenticated smoke with superadmin and owner credentials.
4. Upgrade Vite second:
   - `vite@8.2.2`
   - verify `manualChunks`, base paths, service worker registration, and Hostinger build logs.
5. Run full checks again.
6. Deploy to staging or a temporary production-safe subdomain first.
7. Deploy live only after authenticated smoke passes.

## Do Not Do

- Do not run `npm audit fix --force` directly on production.
- Do not deploy a major router/build upgrade without authenticated smoke.
- Do not change database, API domain, or production credentials as part of this upgrade.

## Approval Phrases

Compatibility implementation only:

```text
APPROVE PATIENTFLOW SECURITY UPGRADE COMPATIBILITY BRANCH
```

Authenticated smoke using supplied credentials:

```text
APPROVE RUN PATIENTFLOW AUTHENTICATED SMOKE
```

Live deployment after all checks pass:

```text
APPROVE DEPLOY PATIENTFLOW SECURITY UPGRADE LIVE
```
