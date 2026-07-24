-- Appointment lead source (Walk-in, Meta, Google, WhatsApp, Referral, …).
-- Also self-healed at runtime by AppointmentController::ensureSourceColumn.
ALTER TABLE `Appointment`
  ADD COLUMN `source` VARCHAR(60) DEFAULT NULL;
