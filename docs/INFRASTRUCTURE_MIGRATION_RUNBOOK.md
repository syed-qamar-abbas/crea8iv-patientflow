# PatientFlow Infrastructure Migration Runbook

This runbook converts [ADR-003](INFRASTRUCTURE_MIGRATION_ADR.md) into an incremental execution plan. It is intentionally non-executable: commands, credentials, provider resources, and production changes must be prepared and approved in a later milestone.

## Safety rules

- Never migrate directly from an untested local change or dirty working tree.
- Never place production credentials in scripts, CI output, tickets, or documentation.
- Never combine database migration, object-storage migration, DNS cutover, and major application behavior changes in one release.
- Never delete Hostinger data during the cutover window.
- Never treat a provider dashboard saying “backup complete” as proof of recoverability.
- Never allow both old and new environments to accept writes without a designed replication/dual-write strategy.
- Prefer roll-forward after new production writes begin; a simple DNS rollback would otherwise lose or fork data.

## Workstreams and dependency order

| Order | Workstream | Depends on | Completion evidence |
| --- | --- | --- | --- |
| 1 | Baseline and data inventory | none | signed inventory and capacity snapshot |
| 2 | Migration ledger; remove runtime DDL | database inventory | clean database boot with read/write-only app credentials |
| 3 | Storage abstraction | object inventory | local and S3-compatible contract tests |
| 4 | Independent backup coverage | storage abstraction | successful isolated DB + object restore |
| 5 | Non-production cloud foundation | provider approval | repeatable environment and security review |
| 6 | Immutable application release | foundation | health-gated deployment and rollback rehearsal |
| 7 | Object copy and dual-read | storage abstraction/foundation | checksummed reconciliation report |
| 8 | Managed MySQL rehearsal | migration ledger/foundation | timed restore, schema/data validation, load test |
| 9 | Production cutover | all prior gates | signed cutover checklist and monitoring evidence |
| 10 | Stabilization and Hostinger retirement | 30-day stability window | final backup, access removal, retirement approval |

## Phase 0: inventory and baseline

### Collect without changing production

- clinic count and status distribution;
- table row counts and total/index bytes by table;
- database engine/version, character sets, collations, SQL mode, and time zone;
- tables without primary keys and foreign-key violations;
- p50/p95/p99 API latency and request rate by route;
- PHP version/extensions, FPM/concurrency limits, memory limit, upload limits, and cron durations;
- uploaded object count/bytes by purpose and clinic, without reading file contents;
- database references whose local file is missing and local files with no database reference;
- daily database growth, object growth, and backup sizes;
- email, Meta, Twilio, AI, DNS, SSL, and webhook dependencies;
- current RPO/RTO expectations and support hours.

### Baseline acceptance criteria

- No production secret or patient content is copied into the report.
- Every durable local path and externally called provider has an owner.
- Current backup coverage explicitly distinguishes database and uploaded files.
- At least one representative load test can be replayed against non-production synthetic data.

## Phase 1: eliminate schema mutation during requests

Current controllers/services perform defensive DDL. Preserve the resulting schema but move ownership into ordered migrations.

### Required implementation milestone

1. Add `SchemaMigration(version, checksum, startedAt, completedAt, status, error)`.
2. Add a CLI-only migration runner with a global migration lock.
3. Refuse checksum changes to completed migrations.
4. Convert every runtime `CREATE TABLE`, `ALTER TABLE`, and `CREATE INDEX` into migrations.
5. Keep compatibility readers only where an older application version genuinely needs them.
6. Remove DDL privileges from the runtime application account.
7. Run schema drift checks in CI and deployment preflight.

### Rollback

Migrations are forward-only. Every migration must include a documented application rollback compatibility window. Destructive column/table removal requires a separate later release after old code and data references are proven absent.

## Phase 2: introduce object storage safely

### Application changes required in a later milestone

- `StorageService` interface for put, open/read, exists, delete/archive, and signed URL generation.
- `LocalStorage` adapter for migration compatibility.
- S3-compatible adapter using a maintained PHP dependency.
- Database fields for object key, provider, size, MIME, SHA-256 checksum, and migration status.
- Private access authorization before a signed URL is issued.
- Structured, PHI-free storage audit events.

### Copy procedure

1. Generate a manifest from database file references: record ID, clinic ID, purpose, relative path, expected size, and checksum.
2. Reject traversal, cross-tenant paths, missing files, and unsupported MIME types into an exception report.
3. Upload with opaque object keys and encryption enabled.
4. Verify checksum, size, and metadata after upload.
5. Mark each row copied only after verification.
6. Repeat until no uncopied valid references remain.
7. Enable object-first reads with local fallback.
8. Monitor fallback reads; investigate until they reach zero.
9. Perform an object restore drill before declaring object storage authoritative.

### Rollback

- Disable object writes and return to local-authoritative reads.
- Keep copied objects; do not mass-delete during incident response.
- Because local writes continue during dual-write, reconcile both manifests before retrying.

## Phase 3: create the non-production foundation

The exact provider is selected only after commercial, privacy, and region review.

### Minimum resources

- isolated project/account and VPC;
- one application node or managed container environment;
- managed MySQL in the private network;
- private object bucket;
- DNS/CDN/WAF test hostname;
- secret store or protected runtime environment injection;
- centralized logs, error tracking, uptime check, and alert receiver;
- separate backup destination/account where supported.

### Hardening checklist

- MFA enforced for every privileged human account.
- No password SSH; named keys and least privilege.
- Database accepts only approved private/trusted sources and requires TLS.
- Bucket anonymous access and directory listing are blocked.
- App node has automatic security patch policy and restricted inbound ports.
- Production and staging cannot share credentials, buckets, databases, webhook tokens, or encryption keys.
- Health endpoint distinguishes liveness from readiness and does not disclose secrets.

## Phase 4: package the existing application

Do not rewrite the application. Produce a repeatable artifact containing:

- Nginx/Apache equivalent routing;
- PHP 8.3, required extensions, Composer production dependencies, and OPcache;
- frontend assets built with a recorded Node/npm lockfile;
- release/version identifier;
- no `.env`, uploads, logs, backups, dumps, tests, or development tools.

The API process writes logs to stdout/stderr. Scheduled and worker processes use the same image/artifact with different entry points.

### Deployment acceptance criteria

- clean environment can start from artifact plus injected configuration;
- readiness fails when database/object dependencies are unavailable;
- previous artifact can be redeployed without schema rollback;
- two app nodes return equivalent results against synthetic test data;
- killing one app node does not lose a file, log, job, or session state.

## Phase 5: managed MySQL rehearsal

### Compatibility rehearsal

1. Create a sanitized or synthetic copy matching production schema and scale.
2. Restore into the exact target MySQL major version.
3. Validate tables, columns, primary keys, foreign keys, collations, views, triggers, and row counts.
4. Run every migration from a known baseline.
5. Execute backend tests, tenant-isolation tests, billing tests, backup tests, and representative API smoke tests.
6. Capture slow queries and explain plans for high-volume routes.
7. Load-test with the planned PHP-FPM worker and database connection limits.
8. Time dump, transfer, import, validation, and application warm-up.

### Data validation report

At minimum compare:

- row counts per table and per clinic for critical tables;
- sums/counts for invoices, payments, expenses, inventory movements, and appointments;
- orphan foreign keys and duplicate unique business keys;
- newest/oldest timestamps and time-zone handling;
- active users/refresh tokens and scheduled jobs;
- uploaded-object reference counts.

Never print patient names, phones, emails, notes, tokens, or file paths into CI logs.

## Phase 6: backup and disaster-recovery gate

### Database

- Provider PITR is enabled and monitored.
- Daily encrypted logical backup is copied to an independent security boundary.
- Retention: daily 35 days; monthly 12 months only if approved by retention policy.
- Backup job emits size, duration, checksum, and success/failure—not contents.

### Objects

- Versioning or equivalent recovery protection is enabled where supported.
- Daily inventory/manifest is stored independently.
- Deletion lifecycle matches product retention and legal requirements.
- A second copy or recoverable version protects against application-level deletion and account compromise.

### Restore drill

1. Restore database to an isolated network and new database name.
2. Restore a representative object set without using the production bucket as the read source.
3. Deploy the previous known-good application artifact.
4. Run integrity and tenant-isolation tests.
5. Record actual RPO, RTO, missing data, manual steps, and corrective actions.

Cutover is blocked until both database and object restore succeed.

## Phase 7: production cutover plan

### Seven days before

- announce maintenance window and internal incident owner;
- lower DNS TTL where applicable;
- freeze unrelated database and infrastructure changes;
- complete final rehearsal using current data volume estimates;
- verify target capacity, alerts, backups, certificates, and provider quotas;
- confirm Hostinger remains available and unchanged for rollback/reference;
- prepare status communication and decision log.

### Twenty-four hours before

- confirm last database and object backup plus independent copy;
- reconcile object migration manifest and ensure fallback-read count is zero or explained;
- verify migration runner reports expected version/checksum state;
- run test deployment, smoke tests, and rollback rehearsal;
- confirm all people in the cutover plan can access only the systems they own.

### Cutover sequence

1. Enable maintenance/read-only mode at the old environment.
2. Stop old cron jobs and confirm no worker is processing.
3. Take the final database dump or complete the final replication catch-up.
4. Record final transaction timestamp, table counts, and backup checksum.
5. Import/catch up target managed MySQL.
6. Run migration ledger verification and data reconciliation.
7. Deploy the approved application artifact to the target environment.
8. Run internal smoke tests while public writes remain disabled.
9. Switch API/portal traffic through DNS or load-balancer routing.
10. Validate auth, tenant isolation, appointments, manual check-in, invoices, expense edit/delete, private files, public booking, email, webhooks, and scheduled-job heartbeat.
11. Enable writes on the new environment only.
12. Start new scheduler/workers with duplicate-execution protection.
13. Monitor continuously for the agreed hypercare window.

### Go/no-go checks before enabling writes

- critical table reconciliation passes;
- no schema drift;
- p95 smoke-test latency is within agreed limit;
- private file access works and anonymous access fails;
- no cross-tenant test failure;
- audit, errors, logs, and alerts arrive centrally;
- database backup/PITR status is healthy;
- old environment is read-only and old cron jobs are stopped.

## Rollback decision

### Before new writes are enabled

A full rollback is safe:

1. route traffic back to Hostinger;
2. disable target schedulers;
3. restore old environment write access;
4. investigate using target logs and reconciliation output.

### After new writes are enabled

Do **not** route users back to an independently writable old database. That creates divergent financial, appointment, and patient data.

Preferred response:

1. stop/limit affected functionality;
2. roll the application artifact forward or back against the new database;
3. restore the new database to a point-in-time clone if corruption occurred;
4. reconcile any provider side effects with idempotency keys;
5. use an approved reverse-migration plan only if engineering has captured and can replay every delta.

## Hypercare

### First two hours

- watch error rate, p95/p99 latency, DB connections/CPU/locks, object failures, and queue age continuously;
- sample each role and more than one tenant;
- compare financial and appointment totals against the cutover snapshot;
- verify no writes reach Hostinger.

### First seven days

- daily backup/status review;
- daily object-reference reconciliation;
- daily slow-query review and capacity trend;
- no unrelated large releases;
- keep Hostinger intact and access-restricted.

### Thirty-day exit criteria

- no unexplained data mismatch;
- two successful independent backups and at least one restore verification after cutover;
- no local-file fallback reads for 14 consecutive days;
- all cron/worker heartbeats and alerts reliable;
- actual cost and capacity reviewed against the ADR;
- formal approval before Hostinger retirement or data deletion.

## Hostinger retirement

Retirement is a separate destructive change requiring explicit approval.

1. take and verify final database, uploads, configuration metadata, and audit exports;
2. document legal/retention requirements for the retained copy;
3. revoke CI deploy keys and old database/application credentials;
4. remove or redirect old DNS only after certificate and webhook checks;
5. confirm old cron jobs cannot run;
6. destroy old data only after written approval and retention requirements are satisfied;
7. record evidence of deletion without recording patient content.

## Incident contacts and decision record template

Before execution, fill in:

| Responsibility | Named owner | Backup owner | Contact channel |
| --- | --- | --- | --- |
| Cutover commander | TBD | TBD | TBD |
| Application | TBD | TBD | TBD |
| Database | TBD | TBD | TBD |
| Storage/backups | TBD | TBD | TBD |
| DNS/CDN | TBD | TBD | TBD |
| Security/privacy | TBD | TBD | TBD |
| Customer communication | TBD | TBD | TBD |

Every go/no-go decision records timestamp, decision maker, evidence reviewed, decision, and next checkpoint.
