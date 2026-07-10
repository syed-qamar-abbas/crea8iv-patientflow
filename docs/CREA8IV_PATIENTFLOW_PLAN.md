# Crea8iv PatientFlow — SaaS Transformation Audit & Architecture Plan

Prepared: June 2026
Scope: Transform the existing Smile Xperts clinic portal into a multi-tenant SaaS platform with minimal redevelopment.

---

## PART 1 — AUDIT OF THE EXISTING SYSTEM

### 1.1 What you actually have (verified from code)

| Layer | Technology | Status |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind, 25 pages | Production-grade, deployed at portal.thesmilexperts.com |
| Backend (production) | **PHP** (no framework, custom router in `backend-php/index.php`), MySQL on Hostinger | Live at api.thesmilexperts.com |
| Backend (dev) | **Node/Express + Prisma + SQLite** (`backend/`) | Duplicate of the PHP API, dev only |
| Auth | Hand-rolled JWT HS256, bcrypt cost 12, refresh tokens in DB (15 min access / 7 day refresh) | Working |
| Modules | Patients, Appointments, Billing/Invoices, Packages, Inventory, Staff, Services, Multi-Branch, WhatsApp Center, Meta Lead Center, Marketing, Gallery, Feedback, AI Hub, Audit Trail, Public Site, Patient Portal, Import Center | All implemented |
| Hosting | Hostinger shared hosting, 2 subdomains, manual zip deploys | Working but manual |

### 1.2 The single most important finding

**Your database is already multi-tenant.** Every table (`Client`, `Appointment`, `Invoice`, `WhatsAppSetting`, `PublicSiteConfig`, …) carries a `clinicId` foreign key to the `Clinic` table, and every controller scopes queries with `WHERE clinicId = ?` using the clinic ID baked into the JWT. The `auth/register` endpoint already creates a new Clinic + owner user.

**You are not building multi-tenancy from scratch. You are ~70% of the way there.** What's missing is the tenant *lifecycle* (registration → approval → payment → activation → suspension), the owner portal above the tenants, and security hardening.

### 1.3 Critical findings (must fix before selling subscriptions)

| # | Finding | Severity | Where |
|---|---|---|---|
| 1 | Production DB password and JWT secrets hardcoded as fallbacks in committed code | 🔴 Critical | `backend-php/config.php` |
| 2 | Demo users with plaintext passwords (`owner123` etc.) shipped inside the frontend JS bundle | 🔴 Critical | `src/config/roles.js` (`DEMO_USERS`) |
| 3 | **No forgot-password flow exists at all** — no route, no UI, no email | 🔴 Critical | Auth |
| 4 | No rate limiting / brute-force lockout on login | 🔴 Critical | `index.php` |
| 5 | `display_errors = 1` in production config — leaks stack traces and paths | 🔴 Critical | `config.php` |
| 6 | WhatsApp/Meta access tokens stored plaintext in DB | 🟠 High | `WhatsAppSetting` table |
| 7 | Refresh tokens never rotated or pruned — table grows forever; stolen token valid 7 days | 🟠 High | `AuthController` |
| 8 | Single CORS origin (`CLIENT_URL`) — breaks the moment you have `clinic1.domain.com`, `clinic2.domain.com` | 🟠 High | `index.php`, `config.php` |
| 9 | Anyone can self-register a clinic via `POST /auth/register` with no approval gate | 🟠 High (becomes a feature after the approval workflow) | `AuthController::register` |
| 10 | Uploads served from webroot with no access control — one clinic's files reachable by another | 🟠 High | `backend-php/uploads/` |
| 11 | Clinic logo stored as base64 `LONGTEXT` in DB — bloats every Clinic query | 🟡 Medium | `Clinic.logo` |
| 12 | Two backends implementing the same API — every feature is built twice | 🟡 Medium (cost) | `backend/` vs `backend-php/` |
| 13 | WhatsApp webhook is one global endpoint — incoming messages need routing to the right tenant by `phoneNumberId` | 🟡 Medium | `WhatsAppController::webhook` |
| 14 | No 2FA, no password policy, no session/device management | 🟡 Medium | Auth |

### 1.4 What should remain / change

**Keep unchanged (your assets):**
- The entire React frontend and its 25 modules — this is the product
- The MySQL schema and `clinicId` row-level tenancy model
- The PHP routing table pattern (simple, fast, debuggable, runs on cheap hosting)
- JWT + refresh-token session model (harden, don't replace)
- Per-clinic WhatsApp/Meta/branding/public-site config (already isolated)

**Refactor:**
- `config.php` → all secrets from environment only, fail hard if missing
- Auth → add forgot-password, rate limiting, refresh rotation, login alerting
- CORS → allowlist function supporting `*.crea8ivpatientflow.com` + verified custom domains
- Uploads → per-tenant folders outside webroot, served through an authenticated PHP endpoint

**Redesign:**
- Tenant lifecycle: `Clinic` gains `status`, `plan`, `trialEndsAt`; new `Subscription`, `Payment`, `RegistrationLead`, `SupportTicket` tables
- New **owner/super-admin portal** (separate React app or guarded section)

**Retire:**
- The Node backend as a production candidate — keep it only as a local dev convenience, or delete it. One canonical backend (PHP, since it's what's live and matches your hosting budget). Maintaining two is the silent tax on every feature you build.
- `DEMO_USERS` and all mock-data fallbacks from production builds

---

## PART 2 — TARGET ARCHITECTURE

### 2.1 Tenancy model decision

**Recommendation: Shared database, shared schema, row-level isolation by `clinicId`** — exactly what you have, hardened.

Why not DB-per-tenant: at PKR 30k/month per clinic with manual onboarding, a DB-per-tenant model multiplies your migration, backup, and connection overhead for zero customer-visible benefit. Row-level isolation with disciplined `clinicId` scoping + a tenant-guard middleware scales comfortably past 1,000 clinics on a single well-indexed MySQL instance (your tables are small per clinic: even 1,000 clinics × 5,000 patients = 5M rows — trivial for MySQL with `(clinicId, …)` composite indexes).

Enforcement upgrades:
1. **Composite indexes** `(clinicId, createdAt)` / `(clinicId, status)` on the big tables (Client, Appointment, Invoice, WhatsAppMessage)
2. **Tenant guard in one place**: a `require_tenant($user)` helper that every controller calls; reject any token whose clinic `status != 'active'` (this is also how suspension works instantly)
3. **Automated cross-tenant test**: a CI script that logs in as clinic A and attempts every GET/PUT/DELETE on clinic B's resource IDs, expecting 404s

### 2.2 Domain strategy

**Recommendation: Option C, phased — start with A.**

- **Phase 1 (launch):** `{clinic}.crea8ivpatientflow.com` via one wildcard DNS record (`*.crea8ivpatientflow.com`) + wildcard SSL. Zero per-tenant setup cost. The PHP API resolves the tenant from the `Host` header subdomain → `Clinic.slug`.
- **Phase 2 (upsell/premium):** custom domains via CNAME. Clinic adds `portal.theirclinic.com → ssl.crea8ivpatientflow.com`; you verify ownership with a TXT record and issue SSL (Cloudflare for SaaS or Caddy on a VPS does this automatically).
- Keep **one shared API host** (`api.crea8ivpatientflow.com`) — only the *frontend* is per-subdomain. Tenant identity comes from the JWT, with subdomain used for pre-login branding (logo/colors on the login page via the existing `public/site` endpoint, keyed by slug instead of hardcoded clinic).

### 2.3 System diagram

```
                        ┌──────────────────────────────┐
  Public visitors ────► │ www.crea8ivpatientflow.com   │  Marketing site + Register form
                        └──────────────┬───────────────┘
                                       │ POST /public/register-clinic
                        ┌──────────────▼───────────────┐
  Clinic users ───────► │ {slug}.crea8ivpatientflow.com│  Tenant portal (same React build,
                        │ customdomain.com (CNAME)     │  branded per tenant at runtime)
                        └──────────────┬───────────────┘
                                       │ JWT (clinicId, role)
                        ┌──────────────▼───────────────┐
  You ────────────────► │ admin.crea8ivpatientflow.com │  Owner portal (superadmin JWT)
                        └──────────────┬───────────────┘
                                       │
                        ┌──────────────▼───────────────┐
                        │  api.crea8ivpatientflow.com  │  Single PHP API
                        │  /api/v1/…      tenant routes│  (tenant guard middleware)
                        │  /api/v1/admin/… owner routes│  (superadmin guard)
                        │  /api/v1/public/… open routes│  (rate limited)
                        └──────┬───────────┬───────────┘
                               │           │
                     ┌─────────▼──┐  ┌─────▼──────────┐
                     │   MySQL    │  │ Tenant uploads │
                     │ (row-level │  │ (outside webroot│
                     │  tenancy)  │  │  per-clinic dir)│
                     └────────────┘  └────────────────┘
                               │
                ┌──────────────┼──────────────┐
         ┌──────▼─────┐ ┌──────▼─────┐ ┌──────▼─────┐
         │ Meta/WhatsApp│ │   SMTP     │ │ Cron jobs  │
         │ Cloud API    │ │ (emails)   │ │ (reminders,│
         │ (per-tenant  │ │            │ │  automations,│
         │  tokens)     │ │            │ │  backups)   │
         └─────────────┘ └────────────┘ └────────────┘
```

### 2.4 Database additions (multi-tenant SaaS layer)

```sql
-- Extend Clinic (the tenant record)
ALTER TABLE Clinic
  ADD COLUMN slug VARCHAR(63) UNIQUE,            -- subdomain
  ADD COLUMN customDomain VARCHAR(255) UNIQUE,
  ADD COLUMN status ENUM('pending','trial','active','suspended','cancelled')
    NOT NULL DEFAULT 'pending',
  ADD COLUMN clinicType ENUM('dental','aesthetic','medical','multi') DEFAULT 'dental',
  ADD COLUMN trialEndsAt DATETIME NULL,
  ADD COLUMN suspendedAt DATETIME NULL,
  ADD COLUMN suspensionReason VARCHAR(255) NULL;

-- Registration leads from the public website
CREATE TABLE RegistrationLead (
  id VARCHAR(36) PRIMARY KEY,
  clinicName VARCHAR(255) NOT NULL,
  contactName VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  whatsapp VARCHAR(50),
  city VARCHAR(100),
  clinicType VARCHAR(30),
  branches INT DEFAULT 1,
  status ENUM('new','contacted','demo_given','payment_pending',
              'payment_review','converted','rejected') DEFAULT 'new',
  notes TEXT,
  clinicId VARCHAR(36) NULL,            -- set when converted
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Subscription per clinic (single plan, two billing cycles)
CREATE TABLE Subscription (
  id VARCHAR(36) PRIMARY KEY,
  clinicId VARCHAR(36) NOT NULL,
  billingCycle ENUM('monthly','annual') NOT NULL,
  amountPKR DECIMAL(12,2) NOT NULL,      -- 30000 or 240000
  startsAt DATETIME NOT NULL,
  expiresAt DATETIME NOT NULL,           -- drives suspension cron
  status ENUM('active','grace','expired','cancelled') DEFAULT 'active',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinicId) REFERENCES Clinic(id)
);

-- Manual payments with screenshot proof
CREATE TABLE Payment (
  id VARCHAR(36) PRIMARY KEY,
  clinicId VARCHAR(36) NOT NULL,
  subscriptionId VARCHAR(36) NULL,
  amountPKR DECIMAL(12,2) NOT NULL,
  method ENUM('bank_transfer','jazzcash','easypaisa','cash','other'),
  screenshotPath VARCHAR(500),           -- uploaded proof
  reference VARCHAR(255),
  status ENUM('submitted','verified','rejected') DEFAULT 'submitted',
  verifiedBy VARCHAR(36) NULL,           -- superadmin user id
  verifiedAt DATETIME NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Support tickets (clinic → you)
CREATE TABLE SupportTicket (
  id VARCHAR(36) PRIMARY KEY,
  clinicId VARCHAR(36) NOT NULL,
  openedBy VARCHAR(36) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  priority ENUM('low','normal','high','urgent') DEFAULT 'normal',
  status ENUM('open','in_progress','waiting','resolved','closed') DEFAULT 'open',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE SupportMessage (
  id VARCHAR(36) PRIMARY KEY,
  ticketId VARCHAR(36) NOT NULL,
  senderType ENUM('clinic','admin'),
  senderId VARCHAR(36),
  body TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Secure password reset
CREATE TABLE PasswordReset (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  tokenHash CHAR(64) NOT NULL,           -- sha256 of token; raw token only in email
  expiresAt DATETIME NOT NULL,           -- 30 minutes
  usedAt DATETIME NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Brute-force protection
CREATE TABLE LoginAttempt (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255), ip VARCHAR(45),
  success TINYINT(1), createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX (email, createdAt), INDEX (ip, createdAt)
);
```

### 2.5 User hierarchy & roles matrix

```
PLATFORM LEVEL (clinicId = NULL)
└── superadmin (you)            — everything, all tenants
    └── platform_support        — tickets + read-only tenant info, no patient data

TENANT LEVEL (clinicId = X)     — existing roles, unchanged
└── owner                       — everything in their clinic
    ├── manager                 — operations, reports, no billing settings
    ├── doctor / operations     — patients, appointments, operational workflow
    ├── reception               — desk, appointments, invoicing
    └── staff                   — limited self view

PATIENT LEVEL
└── portal client               — own appointments/invoices only (already exists)
```

| Capability | superadmin | owner | manager | doctor | reception | staff |
|---|---|---|---|---|---|---|
| Manage tenants, verify payments | ✅ | — | — | — | — | — |
| Platform revenue dashboard | ✅ | — | — | — | — | — |
| Clinic settings, branding, users | — | ✅ | — | — | — | — |
| Financial reports | — | ✅ | ✅ | — | — | — |
| Patient operations profiles | — | ✅ | ✅ | ✅ | ✅ | — |
| Appointments | — | ✅ | ✅ | ✅ | ✅ | view own |
| Invoicing | — | ✅ | ✅ | — | ✅ | — |
| WhatsApp inbox | — | ✅ | ✅ | — | ✅ | — |
| Marketing & campaigns | — | ✅ | ✅ | — | — | — |

Hard rule: **superadmin tokens carry no `clinicId` and are rejected by all tenant routes; tenant tokens are rejected by all `/admin` routes.** Two guards, no overlap. For support cases needing tenant access, implement explicit time-boxed impersonation ("login as clinic", fully audit-logged) rather than giving superadmin blanket data access.

### 2.6 Subscription lifecycle flow

```
Website form ──► RegistrationLead (new)
   │  you review in Owner Portal, contact via WhatsApp
   ▼
status: contacted → demo_given → payment_pending
   │  clinic pays manually, uploads screenshot (public upload link or you attach it)
   ▼
Payment (submitted) ──► you verify ──► Payment (verified)
   │
   ▼
"Activate" button: creates Clinic (status=active) + Subscription (expiry set)
                   + owner User + welcome email with set-password link
   │
   ▼ daily cron
expiresAt - 7d  → reminder (email + WhatsApp to clinic owner)
expiresAt       → status: grace (banner inside portal, 7 days)
expiresAt + 7d  → status: suspended (login blocked with "renew" screen; DATA KEPT)
suspended + 90d → flagged for deletion (manual confirm only — never auto-delete patient data)
```

Suspension enforcement is one line in the tenant guard: token valid but clinic not `active`/`trial`/`grace` → 402 response → frontend shows the renewal screen. Instant, reversible, no data touched.

---

## PART 3 — SECURITY ARCHITECTURE

### 3.1 Login & account security (your "highly secure logins" requirement)

1. **Forgot password (missing today — build first):**
   `POST /auth/forgot-password` → always responds 200 (no email enumeration) → creates `PasswordReset` row (hashed token, 30 min expiry, single-use) → emails link `https://{slug}.crea8ivpatientflow.com/reset-password?token=…` → `POST /auth/reset-password` validates, sets new password, **revokes all refresh tokens for that user**.
2. **Rate limiting:** 5 failed logins per email per 15 min → 15-min lockout; 20 per IP per hour. Same limits on forgot-password and the public booking/registration endpoints. (`LoginAttempt` table — works on shared hosting, no Redis needed.)
3. **Password policy:** min 10 chars, not equal to email, checked against a top-10k common password list. Force-change on first login for admin-created accounts (replace the `ChangeMe@123` pattern in Staff invites with a one-time set-password link).
4. **Refresh token rotation:** each refresh issues a new refresh token and revokes the old; reuse of a revoked token nukes the whole family (stolen-token detection). Nightly prune of expired rows.
5. **2FA (TOTP)** for superadmin from day one; optional per-clinic-owner later.
6. **Session hygiene:** "Logout all devices" button; new-device login email notification for owner accounts.
7. **Remove `DEMO_USERS`** from the production bundle; gate any demo mode behind a build flag.

### 3.2 Platform security

- **Secrets:** environment variables only; rotate the JWT secret and DB password currently in git history. `display_errors=0` in production, log to file.
- **Token encryption:** encrypt WhatsApp/Meta access tokens at rest (libsodium `sodium_crypto_secretbox` with a key from env).
- **Uploads:** store in `storage/{clinicId}/…` outside the webroot; serve via an authenticated endpoint that checks the JWT's clinicId against the path. Validate MIME + extension allowlist; never execute from upload dirs.
- **Audit trail:** you already have `AuditLog` — extend it to auth events (login, failed login, password reset, role change) and all superadmin actions (activate/suspend/impersonate/verify-payment).
- **Headers:** HSTS, `X-Content-Type-Options`, CSP on the portal; the PHP API already does helmet-equivalent basics — codify them.
- **Backups:** nightly `mysqldump` + uploads archive → offsite object storage (Backblaze B2 / S3, encrypted), 30-day retention, **quarterly restore drill**. Disaster recovery target: ≤24h RPO, ≤4h RTO at this stage.

---

## PART 4 — THE THREE FRONT-ENDS

### 4.1 Tenant portal (exists — modify lightly)
- Runtime branding: on load, fetch clinic branding by subdomain slug (extend the existing `public/site` endpoint); login page shows clinic logo/colors instead of hardcoded Smile Expert.
- Add: Renewal/suspended screen, Support ticket widget, "subscription expires in N days" banner.
- Remove: mock data fallbacks, demo users.

### 4.2 Owner portal (new — your biggest build item)
A separate small React app (`admin.crea8ivpatientflow.com`) reusing your existing component library:
- **Pipeline board** for RegistrationLeads (new → contacted → demo → payment → active) — this is your sales CRM
- **Tenant list**: status, plan, expiry, last activity, usage stats; Activate / Suspend / Extend / Impersonate buttons
- **Payment verification queue**: screenshot viewer + verify/reject
- **Revenue dashboard**: MRR (sum of active subscriptions normalized to monthly), active clinic count, expiring-in-30-days list, new registrations this month, simple forecast (current MRR × retention trend)
- **Support inbox**: ticket list + threaded replies
- **System health**: API health endpoint, DB ping, last cron run timestamps, per-tenant WhatsApp connectivity status (you already have `whatsapp/health` per clinic — aggregate it)

### 4.3 Public website (new — marketing)
Static/lightweight site at `www.crea8ivpatientflow.com`: Home, Features, Pricing (PKR 30,000/mo or PKR 20,000/mo billed annually — lead with the annual saving), Industries (Dental / Aesthetic / Medical / Multi-branch), Demo Request, Register Clinic (→ `RegistrationLead`), Contact. Build with plain Vite/Astro — don't couple it to the app.

---

## PART 5 — INFRASTRUCTURE & SCALING

| Stage | Clinics | Infra | Est. monthly cost |
|---|---|---|---|
| Now | 1–10 | Current Hostinger shared/cloud plan; wildcard subdomain + SSL; cron jobs | $10–25 |
| Growth | 10–50 | Hostinger VPS or DigitalOcean droplet (4GB), Caddy/Nginx + PHP-FPM + MySQL on one box, Cloudflare in front (free tier: SSL, CDN, rate limiting, wildcard) | $25–50 |
| Scale | 50–300 | Separate managed MySQL; object storage for uploads/backups; 2 app servers behind LB if needed | $100–250 |
| Big | 300–1,000+ | Read replicas, Redis for rate limiting/queues, queue worker for WhatsApp sends | $400+ |

The architecture (stateless PHP API + JWT + row-level tenancy) requires **no redesign** at any of these steps — only hardware moves. At PKR 30k/clinic/month, infra stays under 2% of revenue throughout.

**Bottlenecks & answers:**
1. *WhatsApp webhook fan-in* — one Meta webhook receives all tenants' messages; route by `phone_number_id → WhatsAppSetting.clinicId` lookup (indexed). Queue sends in `WhatsAppQueue` (exists) and process via cron to respect Meta rate limits.
2. *Shared-host PHP concurrency* — fine to ~30 active clinics; the VPS step removes it.
3. *Base64 logos in DB* — move to file storage during migration.
4. *Reports over big tables* — composite `(clinicId, date)` indexes + pre-aggregated monthly summary table when reports get slow (not before).
5. *Cron reliability on shared hosting* — every automation (reminders, suspension, backups) must be idempotent and log a heartbeat the owner portal displays.

---

## PART 6 — MIGRATION PLAN & ROADMAP (prioritized by business impact)

### Phase 0 — Security hardening (do before anything else)
- Move all secrets to env; rotate DB password + JWT secrets (they're in git)
- `display_errors=0`; remove `DEMO_USERS` from build
- Forgot-password flow (table + 2 endpoints + 2 screens + SMTP)
- Login rate limiting + LoginAttempt table
- Refresh token rotation + pruning
- ✅ Exit criteria: existing Smile Xperts deployment keeps working, now hardened

### Phase 1 — Tenant lifecycle core
- `Clinic` lifecycle columns + slug; `Subscription`, `Payment`, `RegistrationLead` tables
- Tenant guard middleware (status check) + suspended/renewal screen in portal
- `/api/v1/admin/*` route namespace + superadmin role + guards
- Expiry/reminder/suspension cron
- ✅ Exit criteria: you can activate, suspend, and expire a clinic end-to-end

### Phase 2 — Owner portal MVP
- Lead pipeline, tenant list with actions, payment verification queue, revenue dashboard
- ✅ Exit criteria: full workflow (steps 1–10 of your subscription model) runs without touching the database manually

### Phase 3 — Public website + subdomain rollout
- Wildcard DNS/SSL; subdomain → slug branding resolution; marketing site with registration form feeding RegistrationLead
- Migrate The Smile Xperts to `smilexperts.crea8ivpatientflow.com` (keep old domain as custom-domain alias — proves the custom-domain path)
- ✅ Exit criteria: a stranger can register on the website and you can onboard them fully from the owner portal

### Phase 4 — Tenant polish
- Support tickets in tenant portal + owner inbox; WhatsApp webhook multi-tenant routing; uploads moved out of webroot per-clinic; encrypted integration tokens; impersonation with audit log

### Phase 5 — Scale & retention
- VPS move (when >10 active clinics); 2FA for owners; backups + restore drill automation; usage analytics per tenant (your churn early-warning); custom domain self-service

### Suggested order of first 10 concrete tasks
1. Secrets to env + rotate (hours)
2. Forgot password (1–2 days)
3. Rate limiting (half day)
4. Clinic lifecycle columns + tenant guard (1 day)
5. Admin route namespace + superadmin (1 day)
6. Subscription/Payment/Lead tables + endpoints (2 days)
7. Owner portal MVP (1–2 weeks)
8. Expiry cron (half day)
9. Wildcard subdomain + slug branding (2–3 days)
10. Marketing website (1 week, parallelizable)

---

## PART 7 — COST OPTIMIZATION SUMMARY

- **One backend, not two** — consolidate on PHP; the Node copy doubles every future feature's cost
- Stay on Hostinger until ~10 paying clinics; Cloudflare free tier gives SSL/CDN/rate-limit/wildcard for $0
- Shared-schema tenancy = one migration, one backup, one deploy for all tenants
- Reuse the existing React components for the owner portal — same design system, mostly new pages only
- Manual payments first (as planned) — defer gateway integration until volume justifies it; the Payment table is already gateway-ready (add a `gatewayRef` column later)
- Don't build now: native mobile app, automatic payment gateway, per-tenant databases, Kubernetes/microservices — all premature below 100 clinics
