# Industry Template Engine v2

## Purpose

Industry templates configure the portal's language, conversion goal, capabilities,
navigation, scheduling vocabulary, profile fields, workflow stages, dashboard and
module presentation. A template is a runtime configuration contract, not a data
migration and not a permission boundary.

## Canonical templates

| Key | Name | Primary goal |
| --- | --- | --- |
| `dental_clinic` | Dental Clinic | Book dental appointment |
| `aesthetic_clinic` | Aesthetic Clinic | Book consultation |
| `dental_aesthetic_clinic` | Dental & Aesthetic Clinic | Book appointment |
| `interiors_architects` | Interiors & Architects | Schedule consultation |
| `real_estate` | Real Estate | Schedule meeting or viewing |
| `marketing_agency` | Marketing Agency | Schedule discovery meeting |

`healthcare` remains a compatibility fallback for existing tenants. Unknown or
missing backend selections resolve to this fallback without deleting tenant data.

## Schema v2

Every canonical config contains:

- `schemaVersion`: currently `2`.
- `vertical`: broad reporting/product category.
- `primaryGoal`: conversion key, label and default scheduling event type.
- `terms`: singular/plural UI vocabulary.
- `capabilities`: template behavior flags. These do not override backend access controls.
- `navigation.groups`: ordered module groups for future dynamic navigation rendering.
- `scheduling`: default event type and supported event types.
- `profile.fields`: ordered, typed fields for future dynamic profile forms.
- `workflow`: workflow key and ordered stages.
- `dashboard`: KPI labels and primary action.
- `modules`: label, description, icon and `visible` flag by module key.

The frontend recursively merges a server config over its built-in fallback. Arrays
are replaced as complete ordered values; objects are merged by key. This lets the
backend add or override part of a template without erasing safe defaults.

## Safety and authorization

Templates cannot enable clinical record entry, procedure entry, medical-history
entry or public patient media. These capabilities remain false in every built-in
template and are separately enforced by the operations-v1 backend policy.

Module visibility is presentation metadata. Route authorization, plan gating and
backend role/tenant checks remain authoritative and must be enforced independently.

## Switching rules

Changing a tenant's template changes presentation and future workflow defaults. It
must never delete or rewrite existing clients, appointments, invoices, services,
files or historical records. A later template-switch preview will report hidden or
unmapped fields before an administrator confirms a change.

## Dynamic interface storage

The additive `2026-07-11-template-interface-v2` migration adds:

- `Client.profileData`: JSON/TEXT object containing template-specific profile values.
- `Client.workflowStage`: the current template pipeline stage.
- `Appointment.eventType`: appointment, consultation, site visit, viewing, discovery meeting or another configured schedule type.

Common fields such as name, phone, email, notes, status and billing values remain in
their existing columns. Template changes never erase `profileData`; a field that is
not used by the newly selected template is retained but hidden from its form.

The application shell enforces `modules.*.visible` for both navigation and direct
routes. Role authorization and subscription feature gates still run independently.
Pipeline-enabled templates render their workflow stages in the workspace, while
clinic templates retain the operations workspace. Dental historical/reference
sections render only for dental-capable or legacy healthcare templates.

## Implementation locations

- Frontend contract and fallbacks: `src/config/industryTemplates.js`
- Runtime helpers: `src/context/ClinicContext.jsx`
- Production built-ins and persistence: `backend-php/services/industryTemplateService.php`
- Contract tests: `backend-php/tests/industry-template-tests.php`
