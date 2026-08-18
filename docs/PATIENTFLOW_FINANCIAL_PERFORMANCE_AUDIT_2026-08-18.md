# Crea8iv PatientFlow Financial and Performance Audit

Date: 2026-08-18
Scope: Clinic dashboard, invoices/payments, financials, expenses, Reception Desk, related API/data contracts

## Executive status

The client complaints were valid and shared one accounting root cause: invoice `amountPaid` was a cumulative value, but reports grouped that value by the invoice `createdAt` date. This made a payment received this month on an older invoice appear in the older month. The dashboard also requested an all-time summary while displaying the label "Collected This Month".

The release now uses an immutable invoice payment-event ledger. New payments, partial payments, refunds, cancellations, and corrections are recorded as dated events. Dashboard and monthly collection reports use the event date, while invoices retain cumulative `amountPaid` and `balanceDue` for compatibility.

## Complaint-by-complaint result

| Area | Previous behavior | Status after implementation |
|---|---|---|
| Collected This Month | Dashboard displayed an all-time summary | Fixed: dashboard requests the current local calendar month |
| Older invoice paid this month | Payment was grouped under invoice creation month | Fixed: payment is grouped by the date received |
| Partial payments | User had to edit a cumulative amount with ambiguous "Paid Now" wording | Fixed: dedicated Record Payment flow accepts amount received now and payment method |
| Refund/cancellation reporting | Invoice status logic could remove or retain revenue inconsistently | Fixed: dated negative ledger events reverse collections |
| General vs procedure expenses | Combined total existed, but the UI did not clearly separate the two ledgers | Fixed: separate summary cards and separate General/Procedure expense lists |
| Procedure expense visibility | Internal invoice cost appeared only inside cost tracking/profitability | Fixed: read-only paginated Procedure Expenses ledger is visible in Financials |
| Many expenses | No server pagination; the list could become unwieldy | Fixed: 20-row server pages, total record count, total amount, next/previous controls |
| Reception loading | Loaded broad appointment, invoice, and patient datasets before rendering | Fixed: requests only today's appointments/invoices/payments and top five dues |
| Reception cash close | Counted cumulative paid values from invoices created today | Fixed: counts payment events received today, including older invoices |
| Local date boundary | UTC date formatting could shift a Pakistan calendar day near midnight | Fixed in Dashboard, Financials, Invoices, and Reception reporting paths |

## Financial contract

PatientFlow now uses these definitions consistently:

- Collected: signed payment events received inside the selected date range.
- Outstanding: current unpaid balance of active pending/partial invoices.
- General Expenses: manually entered clinic overhead by `expenseDate`.
- Procedure Costs: internal treatment cost attached to a non-cancelled/non-refunded invoice.
- Total Expenses: General Expenses + Procedure Costs.
- Gross Profit: Collected - Procedure Costs.
- Net Profit: Collected - General Expenses - Procedure Costs.

This is an operational cash-collection view. Procedure costs are recognized on the invoice/procedure date, while collections are recognized when received. A future accounting edition can add an accrual/cash toggle, receivables aging, and period locking.

## Data architecture

New table: `InvoicePaymentEntry`

- Tenant-scoped by `clinicId`.
- Linked to invoice and patient.
- Stores signed `amount`, event `type`, `paymentMethod`, and `paidAt`.
- Indexed for clinic/month, invoice history, and patient history.
- Uses an idempotent `sourceKey` for migration backfill.
- Existing invoice rows are not deleted or rewritten by the migration.

Every invoice payment-writing path now updates the invoice and ledger in one database transaction. Retried requests with no cumulative change do not create another financial event.

## Historical-data limitation

Old invoices did not preserve every partial-payment timestamp. The migration therefore backfills existing active collections using `paidAt` when available, otherwise `createdAt`. Future transactions are exact. If The Smile Xperts needs historical month-by-month figures corrected beyond the available timestamps, the old bank/cash records must be reconciled and imported as dated payment events.

## Performance audit

Reception Desk previously waited for three broad lists. It now requests:

- Today's appointments, maximum 200.
- Today's created invoices, maximum 200.
- Today's payment events, maximum 500.
- Five highest outstanding patient balances.

This materially reduces transferred rows and database work. Cached responses still provide instant revisits.

Remaining performance priorities:

1. Add one aggregated `/reception/summary` endpoint when daily clinic volume regularly exceeds the current caps.
2. Split the 1.56 MB frontend JavaScript bundle by route; the build currently passes with a large-chunk warning.
3. Replace broad Dashboard and Reports list requests with dedicated aggregate endpoints.
4. Add production timing telemetry for p50/p95 API latency, slow SQL, and frontend route load time.
5. Add cursor pagination for very large audit, invoice, payment, and patient datasets.

## Wider SaaS audit

### Strong foundations already present

- Tenant-scoped API queries and role gates cover the reviewed financial routes.
- Invoice, patient, appointment, expense, and procedure-cost relationships are explicit.
- Invoice and expense lists have scalable pagination patterns.
- Training Center, replayable onboarding, plan-aware modules, and mobile navigation are present.
- Operations-only clinical safety controls fail closed.
- Invoice math, authentication primitives, migration behavior, package gating, and safety policy have automated tests.

### Important next-phase work

1. Reconciliation and closing
   - Daily cash drawer opening/closing balance.
   - Variance approval by owner/manager.
   - Bank deposit reference and attachment.
   - Locked accounting periods and controlled reopen.

2. Payment maturity
   - Payment history inside Invoice Detail and Patient Profile.
   - Refund amount/reason instead of full-refund only.
   - Split payment methods for one collection.
   - Receipt number and printable payment receipt.
   - Receivables aging buckets: current, 1-30, 31-60, 61-90, 90+ days.

3. Expense maturity
   - Recurring expenses for rent, salary, internet, and subscriptions.
   - Vendor/supplier field, approval state, and cost center.
   - Procedure-cost templates per service with lab/material components.
   - CSV/PDF export and monthly category comparison.

4. Platform scale
   - Route-level code splitting.
   - Background export/report jobs.
   - Query-performance dashboards and error monitoring.
   - Automated backup restore drills and migration rollback runbooks.
   - Currency, timezone, tax, and locale settings per tenant for worldwide rollout.

5. Product usability
   - Role-specific training progress and certification checklist.
   - Contextual help linked to the current screen.
   - Owner, accountant, receptionist, and doctor dashboard presets.
   - Clear empty, loading, retry, offline, and partial-failure states on every core workflow.

## Verification completed

- PHP test suite: 52 passed, 0 failed.
- Financial ledger focused suite: 6 passed, 0 failed.
- Production frontend build: passed.
- PHP syntax checks: passed.
- Whitespace/error checks: passed.
- Desktop Financials layout: no page-level horizontal overflow.
- 390 px mobile Financials and Reception layouts: no page-level horizontal overflow.

The only build warning is the existing large JavaScript bundle warning; it does not block this release but should be handled in the performance phase.

## Safe production release checklist

1. Take a database backup and verify the backup artifact.
2. Deploy the additive migration before exposing API code that writes payment events.
3. Deploy backend and frontend from the same Git checkpoint.
4. Create a small test invoice, record a partial payment, and verify the current-month dashboard changes by that exact amount.
5. Pay an older test invoice and verify the payment appears in the current month, not the invoice month.
6. Add more than 20 general expenses in a test tenant and verify next/previous pages and full-range total.
7. Add an invoice procedure cost and verify General Expenses, Procedure Costs, Total Expenses, and Net Profit.
8. Verify Reception day close against the day's payment-event list.
9. Compare The Smile Xperts current-month total with the clinic's source cash/bank records before announcing reconciliation complete.

## Release decision

The implementation is test-complete and deployment-ready. Production deployment is intentionally a separate approval gate because it runs a new database migration and changes financial reporting semantics.
