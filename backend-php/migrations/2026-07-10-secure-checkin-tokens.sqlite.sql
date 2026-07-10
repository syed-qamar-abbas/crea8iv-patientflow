-- Secure, opaque, short-lived appointment check-in tokens (SQLite).
-- The raw token is never persisted; only its SHA-256 hash is stored.
CREATE TABLE IF NOT EXISTS AppointmentCheckinToken (
  id TEXT NOT NULL PRIMARY KEY,
  clinicId TEXT NOT NULL,
  appointmentId TEXT NOT NULL,
  tokenHash TEXT NOT NULL UNIQUE,
  issuedByUserId TEXT DEFAULT NULL,
  issuedAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  usedAt TEXT DEFAULT NULL,
  usedByUserId TEXT DEFAULT NULL,
  revokedAt TEXT DEFAULT NULL,
  revokeReason TEXT DEFAULT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinicId) REFERENCES Clinic(id) ON DELETE CASCADE,
  FOREIGN KEY (appointmentId) REFERENCES Appointment(id) ON DELETE CASCADE,
  FOREIGN KEY (issuedByUserId) REFERENCES User(id) ON DELETE SET NULL,
  FOREIGN KEY (usedByUserId) REFERENCES User(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS IX_CheckinToken_Clinic_Appointment
  ON AppointmentCheckinToken(clinicId, appointmentId, revokedAt, expiresAt);
CREATE INDEX IF NOT EXISTS IX_CheckinToken_Appointment_Used
  ON AppointmentCheckinToken(appointmentId, usedAt);
