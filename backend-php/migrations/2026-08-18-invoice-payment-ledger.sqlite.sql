-- SQLite companion for local development and migration verification.

CREATE TABLE IF NOT EXISTS InvoicePaymentEntry (
  id TEXT PRIMARY KEY,
  clinicId TEXT NOT NULL,
  invoiceId TEXT NOT NULL,
  clientId TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL DEFAULT 'payment',
  paymentMethod TEXT DEFAULT NULL,
  paidAt TEXT NOT NULL,
  createdBy TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  sourceKey TEXT DEFAULT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (clinicId, sourceKey),
  FOREIGN KEY (clinicId) REFERENCES Clinic(id) ON DELETE CASCADE,
  FOREIGN KEY (invoiceId) REFERENCES Invoice(id) ON DELETE CASCADE,
  FOREIGN KEY (clientId) REFERENCES Client(id) ON DELETE CASCADE,
  FOREIGN KEY (createdBy) REFERENCES User(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS IX_InvoicePayment_Clinic_Date ON InvoicePaymentEntry (clinicId, paidAt);
CREATE INDEX IF NOT EXISTS IX_InvoicePayment_Invoice_Date ON InvoicePaymentEntry (invoiceId, paidAt);
CREATE INDEX IF NOT EXISTS IX_InvoicePayment_Client_Date ON InvoicePaymentEntry (clientId, paidAt);

INSERT OR IGNORE INTO InvoicePaymentEntry
  (id, clinicId, invoiceId, clientId, amount, type, paymentMethod, paidAt, sourceKey)
SELECT lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
       i.clinicId, i.id, i.clientId, i.amountPaid, 'legacy', i.paymentMethod,
       COALESCE(i.paidAt, i.createdAt), 'legacy:' || i.id
FROM Invoice i
WHERE i.amountPaid > 0 AND i.status NOT IN ('refunded', 'cancelled');
