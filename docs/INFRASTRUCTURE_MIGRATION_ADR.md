# ADR-003: Staged Infrastructure Migration from Shared Hosting

- **Status:** Proposed; implementation requires a separate approval
- **Date:** 2026-07-10
- **Scope:** PatientFlow PHP API, React portal, MySQL/MariaDB, uploaded files, scheduled jobs, backups, observability, and white-label routing
- **Decision owner:** PatientFlow engineering/product leadership
- **Related:** [Infrastructure Migration Runbook](INFRASTRUCTURE_MIGRATION_RUNBOOK.md), [Product Boundary](PRODUCT_BOUNDARY.md)

## Decision summary

PatientFlow will remain a React frontend plus PHP 8.3 modular monolith. It will migrate incrementally from Hostinger shared hosting to a single-region, vendor-managed reference architecture that externalizes every durable state dependency:

1. stateless PHP application compute;
2. managed MySQL over a private network;
3. private S3-compatible object storage for uploads and receipts;
4. scheduled jobs and workers with durable leases, retries, and monitoring;
5. centralized logs, metrics, error tracking, and backup verification;
6. a CDN/WAF in front of static portal assets and API ingress.

Microservices, Kubernetes, database-per-tenant, active-active multi-region writes, and a full rewrite are explicitly rejected at the current scale. At approximately 10,000 clinics, the same modular monolith may be deployed in multiple **cells**, with each clinic assigned to one cell. This limits blast radius without creating service-level distributed-system complexity.

No provider may receive patient data until its region, data-processing agreement, subprocessors, encryption, deletion behavior, incident terms, and applicable healthcare/privacy obligations have been reviewed and approved.

## Evidence from the repository

The present design is inexpensive but couples multiple failure domains:

| Current dependency | Repository evidence | Risk |
| --- | --- | --- |
| API compute and runtime state share one filesystem | `backend-php/config.php` fixes `UPLOAD_DIR` under the deployed application directory | App replacement, disk loss, or account suspension can also remove patient files |
| Patient media and expense receipts use local disk | `GalleryController::upload()` and `ExpenseController::saveReceipt()` call `move_uploaded_file()` | Horizontal scaling is unsafe because files exist on only one node |
| Signed files are read synchronously by PHP | `FileController` uses `realpath()`, `filesize()`, and `readfile()` | API workers become file-transfer workers; throughput and availability are tied to local disk |
| Logs are local files | mail fallback, automation, and backup jobs append under `backend-php/logs/` | Logs are lost with the server and cannot support fleet-wide investigation |
| Backups initially land beside production | `cron/backup.php` writes database and upload archives under `app/backups/` | Same-account/server loss can destroy primary data and its backup |
| Off-site database copy excludes uploaded files | `.github/workflows/backup.yml` exports only MySQL | A database restore cannot recover patient documents, gallery files, or expense receipts |
| Scheduled work is host cron plus synchronous network calls | `run-automations.php` scans every active clinic and sends messages in one process | Duplicate cron execution, long runtimes, one-provider latency, and missed schedules are not durably controlled |
| Deployment mutates a live shared directory | `.github/workflows/deploy.yml` uses `rsync` directly to Hostinger | No immutable release, canary, health-gated traffic shift, or automatic application rollback |
| Runtime requests create/alter schema | several controllers/services call `CREATE TABLE` and `ALTER TABLE` | Request latency and availability can depend on DDL privileges and schema locks |
| Migration history is manual | SQL files exist, but there is no schema-version table or migration runner | Environments can silently drift and migration ordering is not provable |
| One PDO connection is created per PHP process/request lifecycle | `DB::getConnection()` maintains only an in-process singleton | PHP-FPM worker counts can exceed managed database connection limits unless explicitly budgeted |
| White-label certificates are still manual | `sslProvider.php` contains an unimplemented Cloudflare path | Manual certificate onboarding does not scale safely beyond a small beta |

## Non-goals

- Rewriting PHP into Node, Java, Go, or another framework.
- Splitting controllers into microservices.
- Replacing MySQL with another database engine.
- Implementing a global clinical/EHR architecture.
- Promising support for 100,000 clinics before usage evidence exists.
- Moving all infrastructure in one maintenance window.
- Treating provider-native backups as the only backup copy.

## Architecture principles

1. **Stateless application nodes:** no durable uploads, logs, queues, sessions, or generated assets live on an app node.
2. **One codebase:** the same tested artifact serves every cell and tenant.
3. **Tenant context everywhere:** database queries, object keys, jobs, metrics, and audit events carry `clinicId` or an irreversible operational tenant identifier.
4. **Private by default:** databases have no unrestricted public ingress; object buckets have no public listing or anonymous reads.
5. **Additive migration:** local and object storage coexist during migration; legacy URL fields remain readable until verification completes.
6. **Measured scaling:** scale on p95 latency, CPU, DB connections, slow queries, queue lag, storage volume, and recovery objectives—not clinic count alone.
7. **Restore before trust:** a backup is not accepted until an automated integrity check and periodic isolated restore succeed.
8. **Boring operations:** managed database and object storage are preferred over operating complex clusters with a small team.

## Reference deployment

The provider names below are a cost and capability reference, not a compliance approval. A simple reference implementation is:

- CDN/WAF/DNS: Cloudflare or equivalent;
- compute: DigitalOcean Droplets or another managed VM/container platform;
- database: DigitalOcean Managed MySQL or equivalent in the same private network;
- object storage: regional S3-compatible storage, selected only after residency/DPA review;
- cache: none initially; managed Valkey/Redis-compatible cache only when measurements justify it;
- transactional email: a managed SMTP/API provider with delivery webhooks;
- logs/errors/metrics: a managed observability provider plus provider-native infrastructure metrics.

DigitalOcean's published 2026 pricing provides a useful small-team baseline: a 2 vCPU/4 GiB basic VM is listed at $24/month; managed databases start at $15/month; object storage starts at $5/month; and load balancers start at $12/month. Managed MySQL includes daily backups/PITR, private networking, TLS, and optional standby nodes. These figures are planning inputs only and exclude taxes, support, logs, email/SMS/WhatsApp, AI usage, engineering time, and compliance services.

Sources:

- [DigitalOcean Droplet pricing](https://www.digitalocean.com/pricing/droplets)
- [DigitalOcean platform pricing](https://www.digitalocean.com/pricing)
- [DigitalOcean managed database capabilities](https://docs.digitalocean.com/products/databases/)
- [DigitalOcean MySQL limits](https://docs.digitalocean.com/products/databases/mysql/details/limits/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)

## Stage 1: controlled beta, approximately 10 clinics

### Topology

```text
Users
  |
CDN/WAF/DNS
  |-- static React portal
  `-- HTTPS API
         |
      1 application VM/container
      Nginx + PHP-FPM + OPcache
         | private TLS
         +-- managed MySQL, single node
         +-- private object storage
         `-- transactional email / Meta / AI providers

Scheduled PHP CLI jobs run on the app node with a MySQL lease.
Logs and errors leave the node immediately.
```

### Recommended capacity envelope

- 2 vCPU / 4 GiB application instance.
- Managed MySQL with at least 2 GiB memory for a real private beta.
- Private object storage with lifecycle rules and versioning where supported.
- PHP-FPM `max_children` capped below the database connection budget.
- One region selected based on clinic location, latency, legal review, and provider availability.

These are starting allocations, not guarantees. Load testing must validate the actual mix of dashboard queries, appointment calendars, reports, file traffic, and external messaging.

### Availability and recovery target

- Target RPO: 15 minutes or better for database transactions; 24 hours is unacceptable for financial and appointment data.
- Target RTO: four hours during controlled beta.
- Provider PITR plus a daily encrypted logical dump in a separate account/bucket.
- Object versioning/inventory plus a daily independent manifest.
- Monthly isolated restore test until the process has succeeded three consecutive times.

### Expected monthly infrastructure band

**USD 80–250/month**, excluding third-party message volume, AI tokens, taxes, support plans, compliance/legal work, and engineering labor.

### Exit triggers

Move to Stage 2 when any two occur for two consecutive weeks, or immediately for an availability requirement:

- more than 25 production clinics or 150 peak concurrent users;
- p95 API latency above 500 ms for five-minute windows after query optimization;
- application CPU above 65% or memory above 75% during normal peaks;
- database CPU above 60%, connections above 60% of limit, or recurring slow queries;
- scheduled-job duration above 20 minutes or queue delay above five minutes;
- business requires application-node redundancy or RTO below one hour.

## Stage 2: early commercial scale, approximately 100 clinics

### Topology changes

- Two or more identical stateless PHP application nodes.
- Managed load balancer with health checks and draining.
- Managed MySQL primary plus at least one standby node for automated failover.
- Dedicated PHP CLI worker process/container.
- Durable `Job` table with leases, unique idempotency keys, retry count, next-attempt time, and dead-letter status.
- Centralized structured logs, error tracking, uptime checks, and alert routing.
- Object storage becomes the only write destination; local read fallback remains temporarily available.

The web API and worker are two process roles from the same repository and release artifact. They are not separate microservices.

### Availability and recovery target

- Target RPO: five minutes or better.
- Target RTO: one hour.
- Daily logical backup retained 35 days; monthly backup retained 12 months if policy permits.
- Quarterly database and object restore exercise.

### Expected monthly infrastructure band

**USD 250–900/month**, depending primarily on database HA size, log volume, object storage, email, and support.

### Exit triggers

- more than 300 production clinics or 1,000 peak concurrent users;
- sustained API load above 100 requests/second or worker throughput above one app node's safe capacity;
- primary database exceeds 60% CPU at peak after indexing/query work;
- database storage exceeds 100 GiB or backup/restore duration threatens RTO;
- report queries materially affect transactional latency;
- cacheable tenant configuration/domain lookups exceed 10% of database load.

## Stage 3: growth scale, approximately 1,000 clinics

### Topology changes

- Autoscaled application pool across at least two availability zones where supported.
- Separate autoscaled worker pool using the same PHP codebase.
- Managed MySQL HA sized from observed working set, with read-only replica only for proven reporting/read workloads.
- Managed Valkey/Redis-compatible cache for short-lived tenant configuration, rate limiting, distributed locks, and queue acceleration—not as a source of truth.
- ProxySQL or an equivalent connection-control layer only if PHP-FPM connection demand cannot be safely managed through process budgets.
- Analytics/reporting workloads moved to a replica or asynchronously maintained summary tables.
- Object inventory, malware scanning workflow, retention rules, and cross-account backup copy.
- Infrastructure defined as code and immutable release artifacts.

### Database strategy

Continue shared-schema, row-scoped tenancy while indexes and operational evidence support it. Every high-volume access path must begin with `clinicId`. Do not introduce database-per-tenant merely because clinic count reached a round number.

Before this stage:

- all runtime DDL must be removed from HTTP request paths;
- every production table must have a primary key;
- a migration ledger and forward-only migration runner must be mandatory;
- slow-query capture and index review must be part of every release;
- financial/audit tables require retention and append-only controls from their respective remediation work.

### Availability and recovery target

- Target RPO: one minute.
- Target RTO: 30 minutes.
- Semiannual regional disaster simulation in addition to quarterly restore drills.

### Expected monthly infrastructure band

**USD 1,500–8,000/month**, strongly dependent on message volume, observability retention, database size, object storage, and support tier.

### Exit triggers

- any tenant or workload can consume more than 5% of shared database capacity;
- a single database incident affects an unacceptable percentage of clinics;
- restore time exceeds the target despite larger nodes and tested automation;
- regulatory/data-residency requirements differ by geography;
- more than 2,500 clinics or projected 12-month growth makes cell placement operationally worthwhile.

## Stage 4: international scale, approximately 10,000 clinics

### Cell-based topology

```text
Global DNS/WAF/CDN
        |
Tenant directory / routing cache
        |
        +-- Cell PK-1: app pool + workers + HA MySQL + object namespace
        +-- Cell PK-2: app pool + workers + HA MySQL + object namespace
        +-- Cell EU-1: app pool + workers + HA MySQL + object namespace
        `-- additional cells based on capacity and residency

Small control plane: tenant identity, subscription, domain-to-cell mapping,
release state, and aggregated non-PHI operational metrics.
```

Each cell runs the same modular monolith. A clinic belongs to exactly one cell. Cross-cell patient queries are prohibited. Platform-wide reporting uses asynchronous, minimized summaries rather than cross-cell transactional joins.

This is justified by blast-radius, data-residency, maintenance, and recovery requirements—not by a desire to introduce microservices.

### Availability and recovery target

- Target cell RPO: one minute or better.
- Target cell RTO: 15–30 minutes.
- A cell failure should not affect unrelated cells.
- Tested tenant move tooling is required before a cell reaches 70% of its agreed capacity.

### Expected monthly infrastructure band

**USD 12,000–60,000+/month**. At this stage staffing, security operations, support, compliance evidence, observability, and data transfer may exceed raw compute costs.

## Storage migration architecture

Future implementation should introduce a narrow storage abstraction rather than rewriting business logic:

```text
Gallery / Expense / Settings controllers
              |
        StorageService interface
          |             |
   LocalStorage     S3CompatibleStorage
   (migration only)    (target)
```

Database records should store an opaque object key and metadata—not an absolute provider URL. Recommended object keys:

```text
clinics/{clinicId}/{purpose}/{yyyy}/{mm}/{uuid}.{verifiedExtension}
```

Required metadata includes clinic ID, object purpose, verified MIME type, size, checksum, creation actor/time, retention class, and archival/deletion state. Raw filenames and patient names must not appear in object keys.

Migration must use dual-read and optional dual-write:

1. release storage abstraction with local storage still authoritative;
2. write new objects to object storage and store object keys;
3. copy legacy files with checksum and tenant-path validation;
4. compare database references, object count, bytes, and checksums;
5. serve through short-lived application-authorized or provider-presigned URLs;
6. switch authoritative reads to object storage while retaining local fallback;
7. remove fallback only after at least 30 days and one successful restore drill.

## Database migration architecture

- Preserve MySQL and the shared-schema tenant model.
- Rehearse against the exact managed MySQL major version. As of July 2026, new DigitalOcean clusters use MySQL 8.4, so MariaDB/MySQL syntax and collation differences must be tested rather than assumed.
- Use TLS and private-network trusted sources.
- Create separate application, migration, backup, and read-only credentials.
- Application credentials must not have `CREATE`, `ALTER`, `DROP`, or broad administrative privileges after runtime DDL is removed.
- Migrations run once as an explicit release step and write checksums/status to a migration ledger.
- For the first small migration, use a maintenance-window logical dump/restore. Introduce replication/online migration only when measured downtime makes it necessary.

## Scheduled work and queue evolution

| Stage | Mechanism | Required control |
| --- | --- | --- |
| 10 clinics | Scheduler invokes PHP CLI | MySQL advisory/lease lock prevents duplicate runner; heartbeat and alert on missed run |
| 100 clinics | Durable MySQL job table + dedicated workers | idempotency key, claim lease, bounded retry, dead-letter state, per-tenant rate limit |
| 1,000 clinics | Worker pool + managed queue/cache if justified | autoscaling on queue age, provider-specific rate control, trace/job correlation |
| 10,000 clinics | Per-cell queues/workers | no cross-cell PHI payloads; cell-local failure and replay |

Queue payloads should carry identifiers, never complete patient records or message secrets. Workers reload authorized data using tenant-scoped queries immediately before execution.

## Observability baseline

Before migration, define service-level indicators:

- API availability and p50/p95/p99 latency by route template;
- 4xx/5xx rates, PHP fatal errors, memory, CPU, disk, and FPM saturation;
- database CPU, connections, storage, replication lag, slow queries, lock waits, and backup age;
- object upload/read/delete error rate and checksum mismatches;
- job success, retries, oldest-job age, provider latency, and dead-letter count;
- authentication failures, cross-tenant test failures, audit failures, and unusual export/file access;
- backup completion, object inventory age, and last successful restore timestamp.

Logs must not contain tokens, passwords, message-provider secrets, raw QR tokens, medical content, uploaded file contents, or full request bodies. Correlation IDs and clinic IDs may be logged under the approved privacy policy.

## Security and operational gates

No production cutover until all are true:

- provider account MFA and least-privilege team roles;
- separate production and non-production accounts/projects;
- VPC/private database connectivity and restricted ingress;
- encrypted transport and provider-managed encryption at rest;
- secret storage outside the repository and release artifact;
- immutable release identifier visible in health/status diagnostics;
- WAF/rate limits for auth, public booking, files, and webhooks;
- private object bucket, blocked public access, tested signed access;
- independent database and object backups;
- migration runner and schema drift check;
- alert ownership and incident escalation path;
- executed rollback rehearsal and restore drill;
- approved DPA, region, retention, deletion, and incident terms.

## Rejected alternatives

### Remain indefinitely on shared hosting

Rejected because local files, same-host backups, cron reliability, runtime DDL, and direct-directory deployment prevent safe horizontal scaling and leave correlated failure modes.

### Immediate Kubernetes

Rejected. It increases platform and on-call complexity without solving the first-order data, backup, migration, and observability problems.

### Immediate microservices

Rejected. Current modules share one transactional database and small-team ownership. Splitting them would add distributed transactions, queues, versioned contracts, and multiple deployment units before those costs are justified.

### Database per clinic

Rejected for the current stages. It multiplies migrations, backups, credentials, connections, and incident operations. Cell-level databases provide a later isolation boundary with far lower operational cardinality.

### Lift-and-shift to one unmanaged VPS with local files

Rejected as the target architecture. It removes Hostinger limitations but preserves the same correlated disk, backup, scaling, and recovery weaknesses.

## Approval checkpoints

Separate approval is required before:

1. selecting or purchasing a provider;
2. creating cloud accounts, networks, databases, buckets, or DNS records;
3. reading or transferring production credentials/data;
4. deploying storage-abstraction or migration-runner code;
5. executing any staging or production data migration;
6. changing DNS, certificates, cron jobs, or production traffic.
