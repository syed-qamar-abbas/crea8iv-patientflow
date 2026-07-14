-- Additive storage for template-driven profiles, workflows and schedule types.
ALTER TABLE Client ADD COLUMN profileData TEXT DEFAULT NULL;
ALTER TABLE Client ADD COLUMN workflowStage TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS IX_Client_Clinic_WorkflowStage ON Client (clinicId, workflowStage);

ALTER TABLE Appointment ADD COLUMN eventType TEXT NOT NULL DEFAULT 'appointment';
CREATE INDEX IF NOT EXISTS IX_Appt_Clinic_EventType_Date ON Appointment (clinicId, eventType, date);
