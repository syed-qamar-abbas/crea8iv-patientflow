CREATE TABLE IF NOT EXISTS `ManualOutreachLog` (
  `id` VARCHAR(36) PRIMARY KEY,
  `clinicId` VARCHAR(36) NOT NULL,
  `clientId` VARCHAR(36) NOT NULL,
  `appointmentId` VARCHAR(36) DEFAULT NULL,
  `userId` VARCHAR(36) DEFAULT NULL,
  `channel` VARCHAR(30) NOT NULL DEFAULT 'whatsapp',
  `purpose` VARCHAR(80) NOT NULL DEFAULT 'custom',
  `message` TEXT DEFAULT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'opened',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `IX_ManualOutreach_Clinic_Created` (`clinicId`, `createdAt`),
  INDEX `IX_ManualOutreach_Client_Created` (`clinicId`, `clientId`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
