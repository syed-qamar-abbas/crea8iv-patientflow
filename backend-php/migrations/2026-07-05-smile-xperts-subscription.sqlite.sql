-- Set The Smile Xperts to the agreed PKR 50,000 monthly subscription.
-- Non-destructive: updates an existing active subscription if present, otherwise
-- inserts one. Historical subscriptions and clinic data are not deleted.

UPDATE Subscription
SET billingCycle = 'monthly',
    amountPKR = 50000,
    expiresAt = CASE
      WHEN expiresAt < datetime('now', '+1 month') THEN datetime('now', '+1 month')
      ELSE expiresAt
    END,
    status = 'active'
WHERE clinicId = 'clinic-smile-expert-001'
  AND status = 'active';

INSERT INTO Subscription (id, clinicId, billingCycle, amountPKR, startsAt, expiresAt, status)
SELECT 'sub-smile-xperts-monthly-50000', 'clinic-smile-expert-001', 'monthly', 50000, CURRENT_TIMESTAMP, datetime('now', '+1 month'), 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM Subscription
  WHERE clinicId = 'clinic-smile-expert-001'
    AND status = 'active'
)
ON CONFLICT(id) DO UPDATE SET
  billingCycle = excluded.billingCycle,
  amountPKR = excluded.amountPKR,
  expiresAt = excluded.expiresAt,
  status = excluded.status;

UPDATE Clinic
SET status = 'active',
    suspendedAt = NULL,
    suspensionReason = NULL
WHERE id = 'clinic-smile-expert-001';
