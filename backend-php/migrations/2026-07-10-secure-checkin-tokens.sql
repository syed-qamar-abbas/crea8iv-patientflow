-- Secure, opaque, short-lived appointment check-in tokens (MySQL/MariaDB).
-- The raw token is never persisted; only its SHA-256 hash is stored.
CREATE TABLE IF NOT EXISTS `AppointmentCheckinToken` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `appointmentId` VARCHAR(36) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `issuedByUserId` VARCHAR(36) DEFAULT NULL,
  `issuedAt` DATETIME NOT NULL,
  `expiresAt` DATETIME NOT NULL,
  `usedAt` DATETIME DEFAULT NULL,
  `usedByUserId` VARCHAR(36) DEFAULT NULL,
  `revokedAt` DATETIME DEFAULT NULL,
  `revokeReason` VARCHAR(255) DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_CheckinToken_Hash` (`tokenHash`),
  KEY `IX_CheckinToken_Clinic_Appointment` (`clinicId`, `appointmentId`, `revokedAt`, `expiresAt`),
  KEY `IX_CheckinToken_Appointment_Used` (`appointmentId`, `usedAt`),
  CONSTRAINT `FK_CheckinToken_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_CheckinToken_Appointment` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_CheckinToken_IssuedBy` FOREIGN KEY (`issuedByUserId`) REFERENCES `User` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_CheckinToken_UsedBy` FOREIGN KEY (`usedByUserId`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
