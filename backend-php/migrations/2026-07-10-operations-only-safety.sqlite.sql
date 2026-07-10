-- P0-2 Phase A: run once through the SQLite migration runner.
ALTER TABLE ClinicFeatureSetting ADD COLUMN operatingMode TEXT NOT NULL DEFAULT 'operations_only';
ALTER TABLE ClinicFeatureSetting ADD COLUMN clinicalRecordEnabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ClinicFeatureSetting ADD COLUMN treatmentProcedureEntryEnabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ClinicFeatureSetting ADD COLUMN medicalHistoryEntryEnabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ClinicFeatureSetting ADD COLUMN patientImagePublicationEnabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ClinicFeatureSetting ADD COLUMN aiClinicalAdviceEnabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ClinicFeatureSetting ADD COLUMN clinicalPolicyVersion TEXT NOT NULL DEFAULT 'operations-v1';

UPDATE ClinicFeatureSetting
SET operatingMode = 'operations_only',
    clinicalRecordEnabled = 0,
    treatmentProcedureEntryEnabled = 0,
    medicalHistoryEntryEnabled = 0,
    patientImagePublicationEnabled = 0,
    aiClinicalAdviceEnabled = 0,
    clinicalPolicyVersion = 'operations-v1';
