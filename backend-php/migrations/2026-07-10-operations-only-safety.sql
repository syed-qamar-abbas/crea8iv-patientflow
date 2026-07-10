-- P0-2 Phase A: explicit, fail-closed product safety boundary.
ALTER TABLE ClinicFeatureSetting
    ADD COLUMN IF NOT EXISTS operatingMode VARCHAR(40) NOT NULL DEFAULT 'operations_only',
    ADD COLUMN IF NOT EXISTS clinicalRecordEnabled TINYINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS treatmentProcedureEntryEnabled TINYINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS medicalHistoryEntryEnabled TINYINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS patientImagePublicationEnabled TINYINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS aiClinicalAdviceEnabled TINYINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS clinicalPolicyVersion VARCHAR(40) NOT NULL DEFAULT 'operations-v1';

UPDATE ClinicFeatureSetting
SET operatingMode = 'operations_only',
    clinicalRecordEnabled = 0,
    treatmentProcedureEntryEnabled = 0,
    medicalHistoryEntryEnabled = 0,
    patientImagePublicationEnabled = 0,
    aiClinicalAdviceEnabled = 0,
    clinicalPolicyVersion = 'operations-v1';
