# PatientFlow Product Boundary (operations-v1)

PatientFlow is currently a multi-tenant **clinic operations platform**. It supports scheduling, reception, operational patient profiles, billing, payments, inventory, staff administration, private file storage, communications, reporting, and white-label portals.

PatientFlow is **not currently an EHR/EMR, clinical decision-support system, e-prescribing system, diagnostic system, or authoritative medico-legal clinical record**. Clinics must keep their approved clinical record in the system and process required by their jurisdiction and professional governance.

## Phase-A safety controls

The following capabilities are disabled by a fail-closed backend policy, even if a client attempts to bypass the user interface:

- creating, updating, changing status, or deleting treatment-plan and procedure-detail entries;
- creating or updating medical-history data;
- publishing patient images to a public clinic website;
- AI symptom assessment, triage, diagnosis, medication/dose advice, or treatment recommendations.

Existing treatment, procedure, and medical-history rows are preserved and remain readable to avoid destructive migration or operational data loss. They are labelled as historical/reference-only and must not be treated as complete or authoritative clinical records. Existing public gallery rows are retained but are no longer returned by the public-site API.

| Existing capability | Phase-A status | Reason |
| --- | --- | --- |
| Treatment plans and status changes | Read-only | No versioned clinical model, authorship/signature workflow, amendment policy, or clinical audit guarantee |
| Dental procedure/tooth detail entry | Read-only | Data structure is specialty-specific and incomplete for an authoritative chart |
| Medical-history entry | Disabled | No governed allergy/problem/medication model, provenance, reconciliation, or clinician verification |
| General patient `notes` | Operational notes only | Free text lacks clinical authorship, attestation, amendment, and medico-legal controls |
| Treatment timeline | Historical/reference view only | It combines operational, billing, appointment, and procedure data and is not a clinical chronology |
| Patient documents and images | Private staff access only | File storage remains operational; public disclosure requires explicit consent, retention, withdrawal, and publication auditing |
| AI receptionist | Administrative questions only | It may handle appointments and published clinic information, but cannot assess symptoms, triage, diagnose, prescribe, or recommend treatment |
| Appointment service names and completion status | Available | These are operational workflow fields and do not establish that a clinical procedure was performed or documented |
| Invoices and procedure costs | Available | Financial records remain valid business records, but do not constitute clinical documentation |

## Capabilities still available

- patient demographic and contact profiles;
- appointment booking, reception, check-in, reminders, calendars, and queues;
- services, staff, branches, and operational notes;
- invoices, payments, packages, expenses, and reports;
- inventory workflows;
- private patient documents and media for authorized staff;
- administrative WhatsApp and AI receptionist workflows, limited to appointments and clinic information;
- feedback, private-beta marketing features, and white-label branding, subject to their own security controls.

## Re-enablement criteria

Clinical capabilities must not be enabled by a feature toggle alone. Re-enablement requires a versioned clinical domain model, data provenance and amendment rules, clinician attribution and signatures where applicable, consent/retention controls, mandatory audit events, jurisdictional compliance review, role-specific authorization, clinical safety testing, export/continuity procedures, and an approved rollout plan. The hard-coded `operations-v1` safety policy must then be replaced through a reviewed migration.

## Operational rollout

Run the additive `2026-07-10-operations-only-safety` migration for the target database before release. The application also creates missing feature-setting columns defensively and defaults them to disabled. No migration deletes or rewrites patient, treatment, procedure, or gallery records.
