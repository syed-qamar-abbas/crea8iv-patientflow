-- Recurring expense templates for monthly owner closeout reminders.
-- Additive only: existing expenses and invoices are not modified.

CREATE TABLE IF NOT EXISTS `RecurringExpense` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `branchId` VARCHAR(36) DEFAULT NULL,
  `categoryId` VARCHAR(36) DEFAULT NULL,
  `description` VARCHAR(255) NOT NULL,
  `amount` DOUBLE NOT NULL DEFAULT 0,
  `frequency` VARCHAR(30) NOT NULL DEFAULT 'monthly',
  `dueDay` INT NOT NULL DEFAULT 1,
  `paymentMethod` VARCHAR(100) DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `lastPostedMonth` VARCHAR(7) DEFAULT NULL,
  `lastPostedAt` DATETIME DEFAULT NULL,
  `createdBy` VARCHAR(36) DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IX_RecurringExpense_Clinic_Active_Due` (`clinicId`, `isActive`, `dueDay`),
  KEY `IX_RecurringExpense_Clinic_Category` (`clinicId`, `categoryId`),
  CONSTRAINT `FK_RecurringExpense_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_RecurringExpense_Branch` FOREIGN KEY (`branchId`) REFERENCES `Branch` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_RecurringExpense_Category` FOREIGN KEY (`categoryId`) REFERENCES `ExpenseCategory` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_RecurringExpense_User` FOREIGN KEY (`createdBy`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
