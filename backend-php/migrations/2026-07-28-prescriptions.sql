-- Prescriptions module (Phase 1). Also self-healed at runtime by
-- PrescriptionController::ensureTable. Collation matches Client so the JOIN works.
CREATE TABLE IF NOT EXISTS `Prescription` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `clientId` VARCHAR(36) NOT NULL,
  `prescriptionNo` VARCHAR(50) DEFAULT NULL,
  `staffId` VARCHAR(36) DEFAULT NULL,
  `doctorName` VARCHAR(191) DEFAULT NULL,
  `doctorQualification` VARCHAR(255) DEFAULT NULL,
  `doctorRegNo` VARCHAR(100) DEFAULT NULL,
  `date` VARCHAR(50) DEFAULT NULL,
  `diagnosis` TEXT DEFAULT NULL,
  `clinicalNotes` TEXT DEFAULT NULL,
  `medicines` MEDIUMTEXT DEFAULT NULL,
  `investigations` TEXT DEFAULT NULL,
  `followUpDate` VARCHAR(50) DEFAULT NULL,
  `additionalNotes` TEXT DEFAULT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `createdBy` VARCHAR(36) DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IX_Prescription_Clinic_Client` (`clinicId`, `clientId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
