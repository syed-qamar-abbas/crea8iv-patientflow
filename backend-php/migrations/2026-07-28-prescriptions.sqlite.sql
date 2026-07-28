-- Prescriptions module (Phase 1). Also self-healed at runtime by
-- PrescriptionController::ensureTable.
CREATE TABLE IF NOT EXISTS Prescription (
  id TEXT PRIMARY KEY,
  clinicId TEXT NOT NULL,
  clientId TEXT NOT NULL,
  prescriptionNo TEXT,
  staffId TEXT,
  doctorName TEXT,
  doctorQualification TEXT,
  doctorRegNo TEXT,
  date TEXT,
  diagnosis TEXT,
  clinicalNotes TEXT,
  medicines TEXT,
  investigations TEXT,
  followUpDate TEXT,
  additionalNotes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  createdBy TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS IX_Prescription_Clinic_Client ON Prescription (clinicId, clientId);
