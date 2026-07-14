CREATE TABLE IF NOT EXISTS ManualOutreachLog (
  id TEXT PRIMARY KEY,
  clinicId TEXT NOT NULL,
  clientId TEXT NOT NULL,
  appointmentId TEXT DEFAULT NULL,
  userId TEXT DEFAULT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  purpose TEXT NOT NULL DEFAULT 'custom',
  message TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'opened',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS IX_ManualOutreach_Clinic_Created ON ManualOutreachLog (clinicId, createdAt);
CREATE INDEX IF NOT EXISTS IX_ManualOutreach_Client_Created ON ManualOutreachLog (clinicId, clientId, createdAt);
