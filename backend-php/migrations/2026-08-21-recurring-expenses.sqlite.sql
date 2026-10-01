-- Recurring expense templates for monthly owner closeout reminders.
-- Additive only: existing expenses and invoices are not modified.

CREATE TABLE IF NOT EXISTS RecurringExpense (
  id TEXT PRIMARY KEY,
  clinicId TEXT NOT NULL,
  branchId TEXT DEFAULT NULL,
  categoryId TEXT DEFAULT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  dueDay INTEGER NOT NULL DEFAULT 1,
  paymentMethod TEXT DEFAULT NULL,
  isActive INTEGER NOT NULL DEFAULT 1,
  lastPostedMonth TEXT DEFAULT NULL,
  lastPostedAt TEXT DEFAULT NULL,
  createdBy TEXT DEFAULT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinicId) REFERENCES Clinic(id) ON DELETE CASCADE,
  FOREIGN KEY (branchId) REFERENCES Branch(id) ON DELETE SET NULL,
  FOREIGN KEY (categoryId) REFERENCES ExpenseCategory(id) ON DELETE SET NULL,
  FOREIGN KEY (createdBy) REFERENCES User(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS IX_RecurringExpense_Clinic_Active_Due ON RecurringExpense (clinicId, isActive, dueDay);
CREATE INDEX IF NOT EXISTS IX_RecurringExpense_Clinic_Category ON RecurringExpense (clinicId, categoryId);
