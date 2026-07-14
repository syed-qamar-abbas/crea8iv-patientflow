-- Additive storage for template-driven profiles, workflows and schedule types.
ALTER TABLE `Client`
  ADD COLUMN `profileData` JSON NULL,
  ADD COLUMN `workflowStage` VARCHAR(80) NULL,
  ADD KEY `IX_Client_Clinic_WorkflowStage` (`clinicId`, `workflowStage`);

ALTER TABLE `Appointment`
  ADD COLUMN `eventType` VARCHAR(80) NOT NULL DEFAULT 'appointment',
  ADD KEY `IX_Appt_Clinic_EventType_Date` (`clinicId`, `eventType`, `date`);
