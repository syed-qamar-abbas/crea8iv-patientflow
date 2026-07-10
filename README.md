<div align="center">

# Crea8iv PatientFlow

**A multi-tenant clinic operations platform — appointments, operational patient profiles, billing, inventory, marketing automation, and an administrative AI receptionist, served to many clinics from a single codebase.**

[![Status](https://img.shields.io/badge/status-production-success)]()
[![Frontend](https://img.shields.io/badge/frontend-React%2018%20%2B%20Vite%205-61dafb)]()
[![Backend](https://img.shields.io/badge/backend-PHP%208.3-777bb4)]()
[![Database](https://img.shields.io/badge/database-MySQL%20%2F%20SQLite-00758f)]()
[![License](https://img.shields.io/badge/license-Proprietary-red)]()

</div>

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Folder Structure](#folder-structure)
5. [Architecture Overview](#architecture-overview)
6. [Installation](#installation)
7. [Environment Variables](#environment-variables)
8. [Build & Deployment](#build--deployment)
9. [Development Workflow](#development-workflow)
10. [User Roles & Permissions](#user-roles--permissions)
11. [API Overview](#api-overview)
12. [Database Overview](#database-overview)
13. [Security Considerations](#security-considerations)
14. [Troubleshooting](#troubleshooting)
15. [Future Roadmap](#future-roadmap)
16. [Documentation Map](#documentation-map)
17. [License](#license)

---

## Project Overview

Crea8iv PatientFlow is a **SaaS clinic-management platform** built for dental, aesthetic, and general medical clinics. A single deployment serves many independent clinics (**tenants**), each with isolated data, its own branding, its own staff, and its own portal URL.

> **Product safety boundary:** PatientFlow currently operates in `operations_only` mode. It is not an EHR/EMR or authoritative clinical record. Treatment/procedure and medical-history writes, public patient-image publication, and AI clinical advice are disabled. See [Product Boundary](docs/PRODUCT_BOUNDARY.md).

The platform has three audiences:

| Surface | Who uses it | Where it lives |
| --- | --- | --- |
| **Clinic Portal** | Clinic owners, managers, doctors, receptionists, etc. | React SPA at `/clinic/<slug>` or a clinic's own domain |
| **Super-Admin Console** | The platform operator (Crea8iv Media) | Same SPA, `/admin` routes, super-admin role |
| **Marketing Website** | Prospective clinics / the public | Static site in [`website/`](website/) |

Tenancy is **path-based by default** — every clinic is reachable at `https://<platform-domain>/clinic/<slug>` with valid SSL and zero per-clinic setup. Clinics that own a domain can additionally point it at the portal (e.g. `portal.theirclinic.com`). See [White-Label Domains](docs/WHITELABEL_DOMAINS.md).

> **Assumption (documented):** This repository is **proprietary commercial software** owned by Crea8iv Media. No open-source license is granted. See [License](#license) and [`LICENSE`](LICENSE).

---

## Features

**Core (every plan)**
- 📅 **Appointments** — calendar, scheduling, conflict detection, reschedule, reminders
- 🧑‍⚕️ **Patients/Clients** — operational profiles, private documents, searchable typeahead (name/phone/email/patient-no)
- 🦷 **Historical clinical-like data** — preserved as read-only reference data; not a complete or authoritative clinical record
- 💳 **Billing** — invoices with PDF generation, packages, refunds, patient balances, **clinic bank/payment details on every invoice**
- 🧾 **Financials** — expenses, procedure costs, profit/margin reporting
- 📦 **Inventory** — stock items and transactions
- 🖼️ **Gallery**, **Feedback**, **Reports**, **Staff & roles**, **Multi-branch**
- ⚙️ **Settings & Branding** — per-clinic logo, colors, invoice details, payment details

**AI / Growth plan (add-on)**
- 💬 **WhatsApp Center** — messaging, automation, reply suggestions
- 🤖 **AI Receptionist** — per-clinic persona, knowledge base, memory
- 📣 **Marketing & Campaigns**, **Meta Leads**, **Bulk Imports**

**Platform (super-admin)**
- Tenant management, impersonation ("manage clinic"), subscription control
- Package assignment (Starter / AppointmentFlow AI)
- Shared platform AI key, marketing-site branding controls

A clinic's active **package** determines which modules are visible; locked modules are hidden from the navigation, routes, and API. See [User Roles & Permissions](#user-roles--permissions).

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React 18 (SPA), Vite 5, React Router 6, Tailwind CSS 3 |
| **Frontend libs** | lucide-react (icons), Recharts (charts), react-big-calendar + moment (calendar), clsx |
| **Backend** | PHP 8.3 — custom lightweight router (no framework), PDO data layer |
| **Auth** | JWT (HS256) access + refresh tokens with rotation, bcrypt (cost 12) |
| **PDF** | FPDF (vendored in `backend-php/libs/`) for invoices |
| **Database** | MySQL 8 (utf8mb4) in production · SQLite for local development |
| **Hosting** | Hostinger shared hosting (LiteSpeed web server) |
| **Deployment** | `rsync` / `scp` over SSH (no CI/CD pipeline) |
| **Marketing site** | Static HTML/CSS/JS (`website/`) |

> A legacy Node.js/Prisma backend exists in [`backend/`](backend/). **It is not the production backend** — see [Folder Structure](#folder-structure) and [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md#legacy-backend).

---

## Folder Structure

```
.
├── src/                      # React clinic portal (SPA) — the main application
│   ├── pages/                #   Route-level screens (Dashboard, Invoices, …)
│   │   └── admin/            #   Super-admin console screens
│   ├── components/           #   Reusable UI (ui/, layout/, clinical/, charts/, …)
│   ├── context/              #   React context providers (ClinicContext, ThemeContext)
│   ├── config/               #   api.js, roles.js, portalPath.js, requiredSettings.js
│   ├── services/             #   API client helpers
│   ├── utils/                #   Pure helpers (branding, formatting, …)
│   └── data/                 #   Static lookup data
│
├── backend-php/              # PRODUCTION API — custom PHP 8.3 application
│   ├── index.php             #   Front controller + the route table (~220 routes)
│   ├── config.php            #   Environment/config constants
│   ├── db.php                #   PDO connection (MySQL or SQLite)
│   ├── helpers.php           #   Shared helpers (JWT, tenancy, responses, …)
│   ├── controllers/          #   31 controllers (one per domain area)
│   ├── services/             #   11 services (pdfService, packageService, …)
│   ├── migrations/           #   SQL migrations (idempotent)
│   ├── cron/                 #   Scheduled jobs (run-automations.php)
│   ├── libs/                 #   Vendored FPDF + fonts
│   ├── schema.sql            #   Canonical database schema (26 tables)
│   ├── scripts/              #   One-off data/maintenance scripts
│   └── uploads/              #   Tenant uploads (gitignored)
│
├── website/                  # Static marketing website (crea8ivmedia.com/patientflow)
├── backend/                  # LEGACY Node.js/Prisma backend (reference only — not deployed)
├── public/                   # Static assets served by Vite
├── docs/                     # Supplementary documentation (deployment, domains, plan)
├── vite.config.js            # Vite build config (base path switches per build)
├── tailwind.config.js        # Tailwind theme
├── .env.example              # Frontend build-time env template
└── backend-php/.env.example  # Backend env template
```

---

## Architecture Overview

```
                         ┌───────────────────────────────────────────┐
   Browser               │            Hostinger / LiteSpeed           │
 ┌──────────┐  HTTPS     │                                            │
 │  React   │ ─────────► │  /clinic/<slug>/…  ─► clinic/ (SPA build)  │
 │   SPA    │            │  /app/api/v1/…     ─► app/ (PHP API)        │
 └──────────┘  JSON+JWT  │                          │                 │
      ▲                  │                          ▼                 │
      │                  │                  ┌────────────────┐        │
      └──────────────────┼──────────────────│  MySQL (tenant │        │
         branded by      │                  │   isolated)    │        │
         hostname/slug   │                  └────────────────┘        │
                         └───────────────────────────────────────────┘
```

- The **frontend** is a single-page app. It is built **twice**: once with base `/clinic/` (path-based portals) and once with base `/` (custom-domain portals). Both talk to the same API.
- The **backend** is a single PHP application behind a **front controller** (`index.php`). Every request is matched against a **route table** and dispatched to a controller method, guarded by an auth/role/tenant **guard**.
- **Multi-tenancy** is enforced in the data layer: authenticated requests carry a `clinicId` (from the JWT), and every query is scoped to it. The super-admin role can act across tenants.

For request flow, authentication flow, and database relationships in detail, see **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)**.

---

## Installation

### Prerequisites
- **Node.js** 18+ and npm (frontend)
- **PHP** 8.3 with `pdo_mysql` (or `pdo_sqlite` for local dev), `iconv`, and `mbstring`
- **Composer** 2.x for the locally rendered, PHI-free check-in QR dependency
- **MySQL** 8 (production) — or SQLite for local development

### 1. Clone & install frontend
```bash
git clone https://github.com/qamar929/crea8ivpatientflow.git
cd crea8ivpatientflow
npm install
```

### 2. Configure the frontend
```bash
cp .env.example .env
# Set VITE_API_URL to your API origin (defaults to http://localhost:4000/api/v1)
```

### 3. Configure the backend
```bash
cd backend-php
composer install --no-dev --prefer-dist --optimize-autoloader
cp .env.example .env
# Fill in DB_* and generate the two JWT secrets:
php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"   # run twice
```

For **local development** you can run the API on SQLite (no MySQL needed):
```env
DB_DRIVER=sqlite
DB_PATH=/absolute/path/to/backend/prisma/dev.db
```

### 4. Initialize the database
```bash
# MySQL
mysql -u <user> -p <dbname> < backend-php/schema.sql

# (Migrations in backend-php/migrations/ are idempotent and can be applied as needed.)
```

### 5. Run locally
```bash
# Terminal 1 — frontend (http://localhost:5173/clinic/)
npm run dev

# Terminal 2 — backend (http://localhost:4000)
cd backend-php && php -S localhost:4000
```

> The Vite dev server serves the SPA under the `/clinic/` base path (see `vite.config.js`). Point `VITE_API_URL` at your running PHP API.

---

## Environment Variables

Two env files. **Never commit `.env` or `.env.production`** — only the `.env.example` templates are tracked.

### Frontend (`.env`) — build-time
| Variable | Purpose | Default |
| --- | --- | --- |
| `VITE_API_URL` | API origin baked into the build | `http://localhost:4000/api/v1` |

### Backend (`backend-php/.env`) — runtime
| Variable | Purpose |
| --- | --- |
| `APP_ENV`, `APP_TIMEZONE` | Environment + timezone (`Asia/Karachi`) |
| `DB_DRIVER` | `mysql` (prod) or `sqlite` (dev) |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASS` | MySQL connection |
| `DB_PATH` | SQLite file path (sqlite only) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | **Required** — API will not boot without them |
| `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Token lifetimes (seconds) |
| `CLIENT_URL`, `WEBSITE_URL`, `PORTAL_HOST` | Allowed origins / hosts (CORS) |
| `TENANT_DOMAIN_SUFFIX` | Suffix for auto-derived clinic URLs (default `crea8ivmedia.com`) |
| `LOGIN_MAX_ATTEMPTS_EMAIL`, `LOGIN_MAX_ATTEMPTS_IP`, `PASSWORD_RESET_TTL` | Auth throttling |
| `SMTP_*`, `MAIL_FROM`, `MAIL_FROM_NAME` | Email; if `SMTP_HOST` is empty, mail is written to `logs/mail.log` |
| `TWILIO_*` | Legacy WhatsApp sandbox (optional) |
| `META_APP_SECRET` | Required when the Meta WhatsApp webhook is enabled |
| `ALLOW_CLINIC_AI_KEYS` | `0` = platform-managed AI keys only (default) |
| `SSL_PROVIDER` | `manual` (Hostinger/hPanel). The Cloudflare provider is a **stub** — do not enable |
| `BACKUP_RETENTION_DAYS`, `BACKUP_REMOTE` | Backup retention + optional off-site target |

The full annotated template is in [`backend-php/.env.example`](backend-php/.env.example).

---

## Build & Deployment

Production currently runs on **Hostinger shared hosting (LiteSpeed)**. GitHub Actions runs backend tests, builds both portal bundles, deploys them by `rsync` over SSH, and performs basic live hash/health checks. The current-host runbook is in [docs/HOSTINGER_DEPLOYMENT.md](docs/HOSTINGER_DEPLOYMENT.md); the approved migration direction is documented in [ADR-003](docs/INFRASTRUCTURE_MIGRATION_ADR.md).

### Frontend — dual build
The portal is built **twice** because it is served from two base paths:

```bash
# 1) Path-based portals  →  <platform>/clinic/<slug>
npm run build -- --base=/clinic/
# deploy dist/ → public_html/clinic/

# 2) Custom-domain portals  →  portal.<clinic>.com
npm run build -- --base=/
# deploy dist/ → <clinic-domain>/public_html/portal/
```

### Backend
Install the locked production dependencies before packaging the PHP app:

```bash
cd backend-php
composer install --no-dev --prefer-dist --optimize-autoloader
```

The PHP app deploys by copying `backend-php/` (including the generated `vendor/` directory) to the server's `app/` directory. Files **excluded** from deploys: `.env`, `uploads/`, `logs/`, `backups/`. **The MySQL database is never touched by file deploys.** Apply the additive secure-check-in-token migration before enabling QR issuance.

### Safety net (`pf-safe`)
The server keeps a `pf-safe/` self-heal copy of the app, portal, and `.htaccess` plus periodic DB dumps, so an accidental overwrite by the co-hosted marketing site auto-recovers. See the deployment runbook.

---

## Development Workflow

- **Branch model:** historically all work lands on `main` and is pushed to `origin/main`. For external contributors, use feature branches and PRs — see [CONTRIBUTING.md](CONTRIBUTING.md).
- **Commit style:** imperative, scoped subject line (e.g. `Invoices: show payment details on all statuses`). Co-authorship trailers are used for AI-assisted commits.
- **No behavior in docs PRs:** documentation and chore commits must not change application behavior.
- **Verify before deploy:** smoke-test the affected screens/endpoints; the portal is a production system serving real clinics.

---

## User Roles & Permissions

Seven clinic roles plus the platform super-admin. Access is enforced **on both ends**: the frontend hides nav/routes (`src/config/roles.js` → `ROLE_ACCESS`), and the backend guards each route (the guard is the 5th element of every route in `backend-php/index.php`).

| Role | Typical access |
| --- | --- |
| **owner** | Everything in the clinic (all modules, settings, staff, financials) |
| **manager** | Almost everything except owner-only controls |
| **doctor** | Appointments, patients, operations workspace, lab |
| **therapist** | Appointments, patients, operations workspace, lab |
| **accountant** | Financials, invoices, reports |
| **receptionist** | Reception desk, appointments, patients, invoices (incl. refunds) |
| **staff** | Limited operational access |
| **super-admin** *(platform)* | Tenant management, impersonation, packages, platform settings |

**Guard types** in the route table:
- `false` — public (no auth)
- `'auth'` — any authenticated user
- `true` — authenticated **and** belongs to an active clinic (tenant)
- `'admin'` — platform super-admin only
- `['owner','manager',…]` — tenant + one of the listed roles

**Package gating:** AI-tier API prefixes (`whatsapp`, `campaigns`, `ai`, `meta`, `import`) are additionally gated by `require_package_feature()` and return `403 feature_not_in_plan` for clinics on the Starter package.

---

## API Overview

- **Base path:** `/<deploy-prefix>/api/v1` (production: `/app/api/v1`)
- **Format:** JSON request/response; `Authorization: Bearer <access-token>`
- **~220 routes** across **31 controllers**, dispatched by the route table in `backend-php/index.php`.

| Area | Prefix | Examples |
| --- | --- | --- |
| Auth | `/auth` | login, refresh, forgot/reset password |
| Patients | `/clients` | list, create, documents, search |
| Appointments | `/appointments` | list, today, conflicts, reschedule |
| Billing | `/invoices` | list, create, PDF, refund |
| Historical treatment | `/treatment-plan`, `/treatment-details` | read-only plans and procedure details in `operations-v1` |
| Financials | `/financials`, `/expenses` | expenses, P&L |
| Inventory | `/inventory` | items, transactions |
| Staff/Users | `/staff`, `/users` | staff records, user accounts |
| Settings | `/settings`, `/public` | clinic settings, public branding |
| WhatsApp | `/whatsapp` | messaging, automation *(AI plan)* |
| AI | `/ai`, `/ai-receptionist` | hub, persona, knowledge *(AI plan)* |
| Marketing | `/campaigns`, `/meta`, `/import` | campaigns, leads, imports *(AI plan)* |
| Platform | `/admin` | tenants, packages, platform settings *(super-admin)* |
| Health | `/health` | liveness check |

The route table is the single source of truth: each row is `[METHOD, PATTERN, Controller, action, guard]`. See [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md#request-flow).

---

## Database Overview

- **Engine:** MySQL 8 (utf8mb4) in production; SQLite locally.
- **Schema:** `backend-php/schema.sql` — **26 tables**. Migrations live in `backend-php/migrations/` and are written to be idempotent.
- **Tenancy:** most tables carry a `clinicId` foreign key to `Clinic`; queries are always scoped by it.

Key tables:

| Group | Tables |
| --- | --- |
| Tenancy & access | `Clinic`, `User`, `RefreshToken`, `ClinicFeatureSetting`, `IndustryTemplate`, `PublicSiteConfig`, `AuditLog` |
| Scheduling & patients | `Appointment`, `Client`, `Staff`, `Branch` |
| Billing & finance | `Invoice`, `InvoiceProcedureCost`, `Package`, `PackageItem`, `ClientPackage`, `Expense`, `ExpenseCategory` |
| Historical treatment reference | `TreatmentProcedureDetail`, `Service` |
| Operations | `InventoryItem`, `InventoryTransaction`, `GalleryItem`, `Feedback`, `Notification`, `Campaign` |

Full relationships are documented in [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md#database-relationships).

---

## Security Considerations

- **Authentication:** JWT HS256 verified with `hash_equals` (no algorithm-confusion); short-lived access tokens + rotating refresh tokens; bcrypt cost 12.
- **Authorization:** per-route guards + per-tenant data isolation by `clinicId`; package-level API gating.
- **Throttling:** login attempts limited per email and per IP; time-limited password-reset links.
- **At rest:** stored third-party AI keys are encrypted (AES-256-CBC) using a key derived from `JWT_SECRET`.
- **Transport/headers:** HSTS, `X-Frame-Options`, `X-Content-Type-Options`, Referrer-Policy, CSP; CORS allowlist.
- **Audit logging:** sensitive actions (deletes, refunds, impersonation, package changes) are recorded in `AuditLog`.
- **Secrets:** never committed — only `.env.example` templates are tracked.

**Reporting & known items:** see [SECURITY.md](SECURITY.md) (includes a documented note about the legacy tracked dev database).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Portal shows a blank page or 404 on deep routes | `.htaccess` rewrite missing/overwritten | Re-deploy `clinic/.htaccess` (SPA fallback). See deployment runbook. |
| "Subscription Inactive" loops / unclickable | Stale build (fixed in app) | Hard-refresh; the API no longer redirects a terminal page onto itself. |
| Invoice PDF shows old design / missing payment details | Browser served a cached PDF | Hard-refresh; PDFs now send `no-store` and the client cache-busts. |
| API returns `401` unexpectedly | Expired access token | Refresh the token; re-login. |
| API returns `403 feature_not_in_plan` | Clinic is on the Starter package | Assign the AI plan via super-admin, or the feature is intentionally hidden. |
| Login fails with throttle error | Too many attempts | Wait for the throttle window (`LOGIN_MAX_ATTEMPTS_*`). |
| Emails not arriving in dev | `SMTP_HOST` empty | Mail is written to `backend-php/logs/mail.log` by design. |

More scenarios: [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) and the deployment runbook.

---

## Future Roadmap

Indicative direction (not commitments). Items already stubbed in code are marked.

- **Online payments** (JazzCash / Easypaisa) for invoices
- **Automated SSL provisioning** via Cloudflare custom hostnames *(stub in `services/sslProvider.php`)*
- **Advanced analytics** and cohort reporting
- **Immutable, health-gated deployments** to replace direct live-directory `rsync`
- **Expanded automated coverage** for migrations, backups, tenant isolation, permissions, billing, and recovery
- **Database history hygiene** — remove the legacy tracked dev DB from history (see [SECURITY.md](SECURITY.md))

---

## Documentation Map

| Document | What's in it |
| --- | --- |
| [README.md](README.md) | This file — overview, setup, and quick reference |
| [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) | Deep architecture, request/auth flow, DB relationships, module responsibilities, dev guidelines |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute, branching, commit style, review checklist |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [SECURITY.md](SECURITY.md) | Security policy, reporting, known items |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community expectations |
| [docs/HOSTINGER_DEPLOYMENT.md](docs/HOSTINGER_DEPLOYMENT.md) | Step-by-step production deployment runbook |
| [docs/INFRASTRUCTURE_MIGRATION_ADR.md](docs/INFRASTRUCTURE_MIGRATION_ADR.md) | Staged architecture for 10, 100, 1,000, and 10,000 clinics |
| [docs/INFRASTRUCTURE_MIGRATION_RUNBOOK.md](docs/INFRASTRUCTURE_MIGRATION_RUNBOOK.md) | Dependency-ordered migration, cutover, rollback, backup, and DR runbook |
| [docs/PRODUCT_BOUNDARY.md](docs/PRODUCT_BOUNDARY.md) | Operations-only product and clinical-safety boundary |
| [docs/WHITELABEL_DOMAINS.md](docs/WHITELABEL_DOMAINS.md) | Path-based + custom-domain tenancy |
| [docs/CREA8IV_PATIENTFLOW_PLAN.md](docs/CREA8IV_PATIENTFLOW_PLAN.md) | Original architecture/transformation plan |

---

## License

**Proprietary — © Crea8iv Media. All rights reserved.**

This software is not licensed for redistribution, modification, or commercial use outside Crea8iv Media without explicit written permission. See [`LICENSE`](LICENSE).

> *If this repository is intended to be open-source instead, replace `LICENSE` with the chosen OSI license (e.g. MIT) and update this section. This was assumed proprietary because the project is a commercial SaaS product.*
