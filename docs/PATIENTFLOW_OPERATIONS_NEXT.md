# PatientFlow Operations Next Steps

This runbook covers the next safe operational improvements after the Phase 2
performance deployment.

## Smoke Tests

Public checks only:

```bash
npm run smoke:patientflow:public
```

Authenticated read-only checks:

```bash
PF_SMOKE_EMAIL="admin@example.com" \
PF_SMOKE_PASSWORD="..." \
npm run smoke:patientflow
```

Authenticated superadmin + owner checks:

```bash
PF_SMOKE_ADMIN_EMAIL="admin@example.com" \
PF_SMOKE_ADMIN_PASSWORD="..." \
PF_SMOKE_OWNER_EMAIL="owner@example.com" \
PF_SMOKE_OWNER_PASSWORD="..." \
PF_SMOKE_REQUIRE_AUTH=true \
npm run smoke:patientflow
```

To require auth success in CI:

```bash
PF_SMOKE_REQUIRE_AUTH=true npm run smoke:patientflow
```

The script checks:

- `/login`, `/dashboard`, `/appointments`, `/invoices`, `/financials`, `/staff`
- `/api/v1/node-health`
- `/api/v1/health`
- CORS preflight for `/api/v1/auth/login`
- Optional authenticated read-only API endpoints

## API Cleanup

Recommended target:

```text
https://api.patientflow.crea8ivmedia.com
```

Keep the current verified upstream as fallback until the new API domain has
passed at least one full deployment cycle and smoke test.

Approval phrase before changing live API routing:

```text
APPROVE PATIENTFLOW CLEAN API DOMAIN LIVE
```

## Database Performance

Do not apply indexes directly on live without:

1. Current live database backup.
2. Migration dry run.
3. Off-peak maintenance window.
4. Smoke test after migration.

Approval phrase before applying DB indexes live:

```text
APPROVE PATIENTFLOW DB INDEX MIGRATION LIVE
```

## Monitoring

Minimum monitors:

- `https://patientflow.crea8ivmedia.com/login`
- `https://patientflow.crea8ivmedia.com/api/v1/health`

Legacy or clinic-branded domains such as `portal.thesmilexperts.com` should
only be monitored after DNS/SSL redirect is confirmed. The production app's
primary health gate is `patientflow.crea8ivmedia.com`.

Alert when:

- HTTP status is not 200.
- API health body does not contain `"status":"ok"`.
- Response time is above 3000 ms for 3 consecutive checks.
