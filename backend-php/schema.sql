-- The Smile Experts Portal Database Schema (MySQL)
-- Suitable for phpMyAdmin/Hostinger/cPanel MySQL Databases

-- SAFETY NOTE:
-- This file is a fresh-install reference only. It must never drop or recreate
-- tables in a live tenant database. Production changes must use additive
-- migrations in backend-php/migrations with a backup/rollback plan.
--
-- Historical DROP TABLE statements were intentionally removed to comply with
-- the no-data-loss deployment rule.

-- Clinic Table
CREATE TABLE `Clinic` (
  `id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `tagline` VARCHAR(255) DEFAULT NULL,
  `logo` LONGTEXT DEFAULT NULL,
  `address` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `whatsapp` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `website` VARCHAR(255) DEFAULT NULL,
  `registrationNo` VARCHAR(100) DEFAULT NULL,
  `invoicePrefix` VARCHAR(50) NOT NULL DEFAULT 'INV',
  `invoiceFooter` TEXT DEFAULT NULL,
  `paymentTerms` TEXT DEFAULT NULL,
  `mission` TEXT DEFAULT NULL,
  `vision` TEXT DEFAULT NULL,
  `servicesOverview` TEXT DEFAULT NULL,
  `primaryColor` VARCHAR(50) NOT NULL DEFAULT '#6366f1',
  `secondaryColor` VARCHAR(50) NOT NULL DEFAULT '#8b5cf6',
  `font` VARCHAR(50) NOT NULL DEFAULT 'Inter',
  `specialties` VARCHAR(100) NOT NULL DEFAULT 'dental',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Public Website Settings Table
CREATE TABLE `PublicSiteConfig` (
  `clinicId` VARCHAR(36) NOT NULL,
  `configJson` LONGTEXT NOT NULL,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`clinicId`),
  CONSTRAINT `FK_PublicSiteConfig_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SaaS feature controls managed by platform superadmin
CREATE TABLE `ClinicFeatureSetting` (
  `clinicId` VARCHAR(64) NOT NULL,
  `industryTemplate` VARCHAR(80) DEFAULT NULL,
  `operatingMode` VARCHAR(40) NOT NULL DEFAULT 'operations_only',
  `clinicalRecordEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `treatmentProcedureEntryEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `medicalHistoryEntryEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `patientImagePublicationEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `aiClinicalAdviceEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `clinicalPolicyVersion` VARCHAR(40) NOT NULL DEFAULT 'operations-v1',
  `marketingEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `metaLeadsEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `importsEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `whatsappEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `whatsappMarketingEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `whatsappAutomationEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `aiEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `aiAutoReplyEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `aiHumanApprovalRequired` TINYINT(1) NOT NULL DEFAULT 1,
  `monthlyAiTokenLimit` INT NOT NULL DEFAULT 0,
  `monthlyWhatsAppLimit` INT NOT NULL DEFAULT 0,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`clinicId`),
  CONSTRAINT `FK_ClinicFeatureSetting_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Industry template definitions used by the UI terminology engine.
-- Built-in rows are seeded idempotently by industryTemplateService.php.
CREATE TABLE `IndustryTemplate` (
  `templateKey` VARCHAR(80) PRIMARY KEY,
  `name` VARCHAR(160) NOT NULL,
  `configJson` JSON NOT NULL,
  `isActive` TINYINT(1) DEFAULT 1,
  `sortOrder` INT DEFAULT 0,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Branch Table
CREATE TABLE `Branch` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `address` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `FK_Branch_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Table
CREATE TABLE `User` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `username` VARCHAR(80) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `phone` VARCHAR(40) DEFAULT NULL,
  `whatsapp` VARCHAR(40) DEFAULT NULL,
  `password` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'receptionist',
  `ledgerMode` VARCHAR(50) NOT NULL DEFAULT 'actual',
  `staffId` VARCHAR(36) DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `twoFAEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `lastLogin` DATETIME DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_User_Email` (`email`),
  UNIQUE KEY `UK_User_Username` (`username`),
  CONSTRAINT `FK_User_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- RefreshToken Table
CREATE TABLE `RefreshToken` (
  `id` VARCHAR(36) NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `userId` VARCHAR(36) NOT NULL,
  `expiresAt` DATETIME NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_RefreshToken_Token` (`token`),
  CONSTRAINT `FK_RefreshToken_User` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Staff Table
CREATE TABLE `Staff` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `branchId` VARCHAR(36) DEFAULT NULL,
  `name` VARCHAR(255) NOT NULL,
  `role` VARCHAR(255) NOT NULL,
  `designation` VARCHAR(255) DEFAULT NULL,
  `specialty` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `avatar` VARCHAR(255) DEFAULT NULL,
  `avatarColor` VARCHAR(50) NOT NULL DEFAULT '#6366f1',
  `qualifications` VARCHAR(255) DEFAULT NULL,
  `experience` VARCHAR(255) DEFAULT NULL,
  `bio` TEXT DEFAULT NULL,
  `workingDays` VARCHAR(255) NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri',
  `workingHours` VARCHAR(255) NOT NULL DEFAULT '09:00-17:00',
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `rating` DECIMAL(3, 2) NOT NULL DEFAULT 5.00,
  `compensationType` VARCHAR(50) NOT NULL DEFAULT 'commission',
  `fixedSalary` DOUBLE NOT NULL DEFAULT 0,
  `commissionRate` DOUBLE NOT NULL DEFAULT 0,
  `treatmentCommissionRates` TEXT DEFAULT NULL,
  `portalRole` VARCHAR(50) DEFAULT NULL,
  `loginEmail` VARCHAR(255) DEFAULT NULL,
  `inviteStatus` VARCHAR(50) NOT NULL DEFAULT 'ready',
  `lastInviteSent` DATETIME DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `FK_Staff_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_Staff_Branch` FOREIGN KEY (`branchId`) REFERENCES `Branch` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Client Table
CREATE TABLE `Client` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `patientNo` VARCHAR(50) DEFAULT NULL,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `dob` VARCHAR(50) DEFAULT NULL,
  `gender` VARCHAR(50) DEFAULT NULL,
  `specialty` TEXT DEFAULT NULL,
  `medicalHistory` TEXT DEFAULT NULL,
  `loyaltyPoints` INT NOT NULL DEFAULT 0,
  `loyaltyTier` VARCHAR(50) NOT NULL DEFAULT 'Bronze',
  `totalSpent` DOUBLE NOT NULL DEFAULT 0,
  `outstandingBalance` DOUBLE NOT NULL DEFAULT 0,
  `latestInvoiceNo` VARCHAR(100) DEFAULT NULL,
  `nextFollowUpDue` VARCHAR(50) DEFAULT NULL,
  `lastVisit` VARCHAR(50) DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `avatarColor` VARCHAR(50) NOT NULL DEFAULT '#6366f1',
  `initials` VARCHAR(10) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `profileData` JSON DEFAULT NULL,
  `workflowStage` VARCHAR(80) DEFAULT NULL,
  `portalEmail` VARCHAR(255) DEFAULT NULL,
  `portalPasswordHash` VARCHAR(255) DEFAULT NULL,
  `referredBy` VARCHAR(255) DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_Client_Clinic_PatientNo` (`clinicId`, `patientNo`),
  KEY `IX_Client_Clinic_Status_Created` (`clinicId`, `status`, `createdAt`),
  KEY `IX_Client_Clinic_Name` (`clinicId`, `name`),
  KEY `IX_Client_Clinic_WorkflowStage` (`clinicId`, `workflowStage`),
  CONSTRAINT `FK_Client_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Service Table
CREATE TABLE `Service` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `specialty` VARCHAR(100) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `price` DOUBLE NOT NULL,
  `defaultProcedureCost` DOUBLE DEFAULT NULL,
  `duration` INT NOT NULL,
  `description` TEXT DEFAULT NULL,
  `popular` TINYINT(1) NOT NULL DEFAULT 0,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `FK_Service_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Appointment Table
CREATE TABLE `Appointment` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `branchId` VARCHAR(36) DEFAULT NULL,
  `clientId` VARCHAR(36) NOT NULL,
  `staffId` VARCHAR(36) NOT NULL,
  `serviceId` VARCHAR(36) DEFAULT NULL,
  `date` VARCHAR(50) NOT NULL,
  `startTime` VARCHAR(50) NOT NULL,
  `endTime` VARCHAR(50) NOT NULL,
  `duration` INT NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
  `room` VARCHAR(100) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `price` DOUBLE NOT NULL,
  `specialty` VARCHAR(100) NOT NULL,
  `eventType` VARCHAR(80) NOT NULL DEFAULT 'appointment',
  `source` VARCHAR(60) DEFAULT NULL,
  `checkedIn` TINYINT(1) NOT NULL DEFAULT 0,
  `checkinTime` DATETIME DEFAULT NULL,
  `qrCode` TEXT DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IX_Appt_Clinic_Date_Status_Staff` (`clinicId`, `date`, `status`, `staffId`),
  KEY `IX_Appt_Clinic_Client_Date` (`clinicId`, `clientId`, `date`),
  KEY `IX_Appt_Clinic_Staff` (`clinicId`, `staffId`),
  KEY `IX_Appt_Clinic_EventType_Date` (`clinicId`, `eventType`, `date`),
  CONSTRAINT `FK_Appointment_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_Appointment_Branch` FOREIGN KEY (`branchId`) REFERENCES `Branch` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_Appointment_Client` FOREIGN KEY (`clientId`) REFERENCES `Client` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_Appointment_Staff` FOREIGN KEY (`staffId`) REFERENCES `Staff` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_Appointment_Service` FOREIGN KEY (`serviceId`) REFERENCES `Service` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Secure appointment check-in tokens. QR payloads contain only an opaque
-- random token; the database persists only its SHA-256 hash.
CREATE TABLE `AppointmentCheckinToken` (
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

-- Package Table
CREATE TABLE `Package` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `totalPrice` DOUBLE NOT NULL,
  `validity` INT NOT NULL,
  `specialty` VARCHAR(100) NOT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `FK_Package_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PackageItem Table
CREATE TABLE `PackageItem` (
  `id` VARCHAR(36) NOT NULL,
  `packageId` VARCHAR(36) NOT NULL,
  `serviceId` VARCHAR(36) NOT NULL,
  `sessions` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  CONSTRAINT `FK_PackageItem_Package` FOREIGN KEY (`packageId`) REFERENCES `Package` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_PackageItem_Service` FOREIGN KEY (`serviceId`) REFERENCES `Service` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ClientPackage Table
CREATE TABLE `ClientPackage` (
  `id` VARCHAR(36) NOT NULL,
  `clientId` VARCHAR(36) NOT NULL,
  `packageId` VARCHAR(36) NOT NULL,
  `purchaseDate` VARCHAR(50) NOT NULL,
  `expiryDate` VARCHAR(50) NOT NULL,
  `totalSessions` INT NOT NULL,
  `usedSessions` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `amountPaid` DOUBLE NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `FK_ClientPackage_Client` FOREIGN KEY (`clientId`) REFERENCES `Client` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_ClientPackage_Package` FOREIGN KEY (`packageId`) REFERENCES `Package` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoice Table
CREATE TABLE `Invoice` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `clientId` VARCHAR(36) NOT NULL,
  `appointmentId` VARCHAR(36) DEFAULT NULL,
  `invoiceNo` VARCHAR(100) NOT NULL,
  `items` TEXT NOT NULL,
  `subtotal` DOUBLE NOT NULL,
  `previousBalance` DOUBLE NOT NULL DEFAULT 0,
  `discount` DOUBLE NOT NULL DEFAULT 0,
  `tax` DOUBLE NOT NULL DEFAULT 0,
  `total` DOUBLE NOT NULL,
  `grandTotal` DOUBLE NOT NULL DEFAULT 0,
  `amountPaid` DOUBLE NOT NULL DEFAULT 0,
  `balanceDue` DOUBLE NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
  `paymentMethod` VARCHAR(100) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `dueDate` VARCHAR(50) DEFAULT NULL,
  `paidAt` DATETIME DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_Invoice_InvoiceNo` (`invoiceNo`),
  UNIQUE KEY `UK_Invoice_AppointmentId` (`appointmentId`),
  KEY `IX_Invoice_Clinic_Created` (`clinicId`, `createdAt`),
  KEY `IX_Invoice_Clinic_Client_Created` (`clinicId`, `clientId`, `createdAt`),
  KEY `IX_Invoice_Clinic_Status_Due` (`clinicId`, `status`, `dueDate`),
  CONSTRAINT `FK_Invoice_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_Invoice_Client` FOREIGN KEY (`clientId`) REFERENCES `Client` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_Invoice_Appointment` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Expense categories and entries are additive financial records. They never
-- rewrite invoices or patient balances.
CREATE TABLE `ExpenseCategory` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `type` VARCHAR(40) NOT NULL DEFAULT 'general',
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_ExpenseCategory_Clinic_Name` (`clinicId`, `name`),
  KEY `IX_ExpenseCategory_Clinic_Active` (`clinicId`, `isActive`),
  CONSTRAINT `FK_ExpenseCategory_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `Expense` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `branchId` VARCHAR(36) DEFAULT NULL,
  `categoryId` VARCHAR(36) DEFAULT NULL,
  `description` VARCHAR(255) NOT NULL,
  `amount` DOUBLE NOT NULL DEFAULT 0,
  `expenseDate` DATE NOT NULL,
  `paymentMethod` VARCHAR(100) DEFAULT NULL,
  `receiptUrl` TEXT DEFAULT NULL,
  `createdBy` VARCHAR(36) DEFAULT NULL,
  `archivedAt` DATETIME DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IX_Expense_Clinic_Date` (`clinicId`, `expenseDate`),
  KEY `IX_Expense_Clinic_Category` (`clinicId`, `categoryId`, `expenseDate`),
  KEY `IX_Expense_Clinic_Branch` (`clinicId`, `branchId`, `expenseDate`),
  CONSTRAINT `FK_Expense_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_Expense_Branch` FOREIGN KEY (`branchId`) REFERENCES `Branch` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_Expense_Category` FOREIGN KEY (`categoryId`) REFERENCES `ExpenseCategory` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_Expense_User` FOREIGN KEY (`createdBy`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `InvoiceProcedureCost` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `invoiceId` VARCHAR(36) NOT NULL,
  `invoiceItemIndex` INT NOT NULL DEFAULT 0,
  `appointmentId` VARCHAR(36) DEFAULT NULL,
  `clientId` VARCHAR(36) NOT NULL,
  `serviceId` VARCHAR(36) DEFAULT NULL,
  `patientCharge` DOUBLE NOT NULL DEFAULT 0,
  `procedureCost` DOUBLE NOT NULL DEFAULT 0,
  `notes` TEXT DEFAULT NULL,
  `createdBy` VARCHAR(36) DEFAULT NULL,
  `updatedBy` VARCHAR(36) DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_ProcedureCost_Invoice_Item` (`clinicId`, `invoiceId`, `invoiceItemIndex`),
  KEY `IX_ProcedureCost_Clinic_Service` (`clinicId`, `serviceId`),
  KEY `IX_ProcedureCost_Clinic_Client` (`clinicId`, `clientId`),
  CONSTRAINT `FK_ProcedureCost_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProcedureCost_Invoice` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProcedureCost_Appointment` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_ProcedureCost_Client` FOREIGN KEY (`clientId`) REFERENCES `Client` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_ProcedureCost_Service` FOREIGN KEY (`serviceId`) REFERENCES `Service` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_ProcedureCost_CreatedBy` FOREIGN KEY (`createdBy`) REFERENCES `User` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_ProcedureCost_UpdatedBy` FOREIGN KEY (`updatedBy`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `TreatmentProcedureDetail` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `clientId` VARCHAR(36) NOT NULL,
  `appointmentId` VARCHAR(36) DEFAULT NULL,
  `invoiceId` VARCHAR(36) DEFAULT NULL,
  `serviceId` VARCHAR(36) DEFAULT NULL,
  `staffId` VARCHAR(36) DEFAULT NULL,
  `procedureType` VARCHAR(120) NOT NULL,
  `toothNumber` VARCHAR(40) DEFAULT NULL,
  `jaw` VARCHAR(20) DEFAULT NULL,
  `side` VARCHAR(20) DEFAULT NULL,
  `canalType` VARCHAR(80) DEFAULT NULL,
  `extractionType` VARCHAR(80) DEFAULT NULL,
  `crownMaterial` VARCHAR(120) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `followUpDate` DATE DEFAULT NULL,
  `performedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdBy` VARCHAR(36) DEFAULT NULL,
  `archivedAt` DATETIME DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IX_TreatmentDetail_Clinic_Client_Date` (`clinicId`, `clientId`, `performedAt`),
  KEY `IX_TreatmentDetail_Clinic_Staff_Date` (`clinicId`, `staffId`, `performedAt`),
  CONSTRAINT `FK_TreatmentDetail_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_TreatmentDetail_Client` FOREIGN KEY (`clientId`) REFERENCES `Client` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_TreatmentDetail_Appointment` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_TreatmentDetail_Invoice` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_TreatmentDetail_Service` FOREIGN KEY (`serviceId`) REFERENCES `Service` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_TreatmentDetail_Staff` FOREIGN KEY (`staffId`) REFERENCES `Staff` (`id`) ON DELETE SET NULL,
  CONSTRAINT `FK_TreatmentDetail_User` FOREIGN KEY (`createdBy`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- InventoryItem Table
CREATE TABLE `InventoryItem` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `category` VARCHAR(255) NOT NULL,
  `specialty` VARCHAR(100) DEFAULT NULL,
  `quantity` DOUBLE NOT NULL,
  `unit` VARCHAR(50) NOT NULL DEFAULT 'units',
  `reorderLevel` DOUBLE NOT NULL DEFAULT 10,
  `costPerUnit` DOUBLE NOT NULL,
  `supplier` VARCHAR(255) DEFAULT NULL,
  `expiryDate` VARCHAR(50) DEFAULT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IX_Inventory_Clinic_Active_Qty` (`clinicId`, `isActive`, `quantity`),
  CONSTRAINT `FK_InventoryItem_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- InventoryTransaction Table
CREATE TABLE `InventoryTransaction` (
  `id` VARCHAR(36) NOT NULL,
  `itemId` VARCHAR(36) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `quantity` DOUBLE NOT NULL,
  `reason` VARCHAR(255) DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `FK_InventoryTransaction_Item` FOREIGN KEY (`itemId`) REFERENCES `InventoryItem` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Feedback Table
CREATE TABLE `Feedback` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) DEFAULT NULL,
  `clientId` VARCHAR(36) NOT NULL,
  `appointmentId` VARCHAR(36) DEFAULT NULL,
  `staffRating` INT NOT NULL,
  `serviceRating` INT NOT NULL,
  `overallRating` INT NOT NULL,
  `comment` TEXT DEFAULT NULL,
  `wouldRecommend` TINYINT(1) NOT NULL DEFAULT 1,
  `isPublic` TINYINT(1) NOT NULL DEFAULT 0,
  `staffId` VARCHAR(36) DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_Feedback_AppointmentId` (`appointmentId`),
  CONSTRAINT `FK_Feedback_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_Feedback_Client` FOREIGN KEY (`clientId`) REFERENCES `Client` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_Feedback_Appointment` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- GalleryItem Table
CREATE TABLE `GalleryItem` (
  `id` VARCHAR(36) NOT NULL,
  `clientId` VARCHAR(36) NOT NULL,
  `appointmentId` VARCHAR(36) DEFAULT NULL,
  `type` VARCHAR(50) NOT NULL DEFAULT 'before',
  `imageUrl` TEXT NOT NULL,
  `service` VARCHAR(255) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `isPrivate` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `FK_GalleryItem_Client` FOREIGN KEY (`clientId`) REFERENCES `Client` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Manual WhatsApp Outreach Log (Starter click-to-WhatsApp, no API sending)
CREATE TABLE `ManualOutreachLog` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `clientId` VARCHAR(36) NOT NULL,
  `appointmentId` VARCHAR(36) DEFAULT NULL,
  `userId` VARCHAR(36) DEFAULT NULL,
  `channel` VARCHAR(30) NOT NULL DEFAULT 'whatsapp',
  `purpose` VARCHAR(80) NOT NULL DEFAULT 'custom',
  `message` TEXT DEFAULT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'opened',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IX_ManualOutreach_Clinic_Created` (`clinicId`, `createdAt`),
  KEY `IX_ManualOutreach_Client_Created` (`clinicId`, `clientId`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Campaign Table
CREATE TABLE `Campaign` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `trigger` VARCHAR(100) NOT NULL,
  `subject` VARCHAR(255) DEFAULT NULL,
  `body` TEXT NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'draft',
  `sentCount` INT NOT NULL DEFAULT 0,
  `openCount` INT NOT NULL DEFAULT 0,
  `scheduledAt` DATETIME DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `FK_Campaign_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AuditLog Table
CREATE TABLE `AuditLog` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `userId` VARCHAR(36) DEFAULT NULL,
  `action` VARCHAR(255) NOT NULL,
  `entity` VARCHAR(255) NOT NULL,
  `entityId` VARCHAR(36) DEFAULT NULL,
  `oldData` TEXT DEFAULT NULL,
  `newData` TEXT DEFAULT NULL,
  `ip` VARCHAR(50) DEFAULT NULL,
  `userAgent` TEXT DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `FK_AuditLog_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_AuditLog_User` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notification Table
CREATE TABLE `Notification` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) DEFAULT NULL,
  `userId` VARCHAR(36) DEFAULT NULL,
  `clientId` VARCHAR(36) DEFAULT NULL,
  `type` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `body` TEXT NOT NULL,
  `read` TINYINT(1) NOT NULL DEFAULT 0,
  `channel` VARCHAR(50) NOT NULL DEFAULT 'push',
  `sentAt` DATETIME DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- SEED DATA
-- ==========================================

-- 1. Clinic
INSERT INTO `Clinic` (`id`, `name`, `tagline`, `logo`, `address`, `phone`, `whatsapp`, `email`, `website`, `registrationNo`, `invoicePrefix`, `invoiceFooter`, `paymentTerms`, `mission`, `vision`, `servicesOverview`, `primaryColor`, `secondaryColor`, `font`, `specialties`) VALUES
('clinic-smile-expert-001', 'The Smile Expert', 'Premium Dental Care Portal', 'SE', 'Dental Clinic, Lahore, Pakistan', '+92 42 111 764 533', '+92 300 764 5330', 'care@thesmileexpert.com', 'portal.thesmileexpert.com', 'DENT-LHR-2026-001', 'TSE', 'Thank you for choosing The Smile Expert. Please follow the aftercare instructions shared by your dentist.', 'Partial payments are tracked against the same patient number. Remaining dues appear on the next invoice.', 'Deliver precise, comfortable, and transparent dental care through a modern digital clinic workflow.', 'To become the most trusted dental care experience for families, smile design, restorative dentistry, and implants.', 'Consultation, scaling, whitening, fillings, root canal, crowns, veneers, implants, extractions, oral surgery, aligners, and pediatric dental care.', '#0f766e', '#2563eb', 'Inter', 'dental');

-- 2. Branch
INSERT INTO `Branch` (`id`, `clinicId`, `name`, `address`, `phone`, `isActive`) VALUES
('branch-smile-expert-main', 'clinic-smile-expert-001', 'The Smile Expert Main Branch', 'Dental Clinic, Lahore, Pakistan', '+92 42 111 764 533', 1);

-- 3. Users
-- Demo hashes only. For production, create users through set-password invites.
INSERT INTO `User` (`id`, `clinicId`, `name`, `email`, `password`, `role`, `ledgerMode`, `staffId`, `isActive`, `twoFAEnabled`) VALUES
('u001', 'clinic-smile-expert-001', 'Owner', 'owner@thesmileexpert.com', '$2a$12$8yjoCY6.jkDF0GXsQa84ROL9sgOW69v.7IMJiQqNOqUZZt6yRNLXe', 'owner', 'actual', 's001', 1, 0),
('u002', 'clinic-smile-expert-001', 'Reception Desk', 'reception@thesmileexpert.com', '$2a$12$Jtzc5HWi7dSkaKDXFQ1M6.pWr29l6v4b5v8PiANXq0QCtvffBCo.m', 'receptionist', 'actual', 's004', 1, 0),
('u003', 'clinic-smile-expert-001', 'Dental Staff', 'staff@thesmileexpert.com', '$2a$12$aLbWDWiD8s67K3pvJQURXecXEM5JyID0inGBROtVRxZ2j6fhDge5S', 'staff', 'actual', 's002', 1, 0),
('u004', 'clinic-smile-expert-001', 'Regular Price Owner', 'regular@thesmileexpert.com', '$2y$12$ddG0wBl27aVprp574XCf4uRpc94.xHeAFVPU9amhs..ybzbxj0eJ6', 'owner', 'regular', 's001', 1, 0);

-- 4. Staff
INSERT INTO `Staff` (`id`, `clinicId`, `branchId`, `name`, `role`, `designation`, `specialty`, `phone`, `email`, `avatar`, `avatarColor`, `qualifications`, `experience`, `bio`, `workingDays`, `workingHours`, `status`, `rating`, `compensationType`, `fixedSalary`, `commissionRate`, `treatmentCommissionRates`, `portalRole`, `loginEmail`, `inviteStatus`) VALUES
('s001', 'clinic-smile-expert-001', 'branch-smile-expert-main', 'Dr. Hammad Raza', 'Lead Dental Surgeon', 'Owner Dentist', 'dental', '+92 300 1111111', 'owner@thesmileexpert.com', 'HR', '#0f766e', 'BDS, FCPS Oral Surgery', '15 years', 'Expert implantologist and oral surgeon.', 'Mon,Tue,Wed,Thu,Fri', '09:00-17:00', 'active', 4.90, 'commission', 0, 35, '{}', 'owner', 'owner@thesmileexpert.com', 'ready'),
('s002', 'clinic-smile-expert-001', 'branch-smile-expert-main', 'Dr. Ayesha Siddiqui', 'Cosmetic Dentist', 'Smile Design Specialist', 'dental', '+92 300 2222222', 'ayesha@thesmileexpert.com', 'AS', '#2563eb', 'BDS, Cosmetic Dentistry Fellowship', '9 years', 'Dedicated to perfect aesthetic smiles and crowns.', 'Mon,Tue,Wed,Thu,Fri', '09:00-17:00', 'active', 4.80, 'commission', 0, 30, '{}', 'staff', 'ayesha@thesmileexpert.com', 'ready'),
('s003', 'clinic-smile-expert-001', 'branch-smile-expert-main', 'Dr. Bilal Khan', 'Endodontist', 'Root Canal Specialist', 'dental', '+92 300 3333333', 'bilal@thesmileexpert.com', 'BK', '#7c3aed', 'BDS, MCPS Endodontics', '11 years', 'Pain-free root canals and micro-dentistry.', 'Mon,Tue,Wed,Thu,Fri', '09:00-17:00', 'active', 4.80, 'commission', 0, 28, '{}', 'staff', 'bilal@thesmileexpert.com', 'ready'),
('s004', 'clinic-smile-expert-001', 'branch-smile-expert-main', 'Sana Mir', 'Receptionist', 'Front Desk', 'dental', '+92 300 4444444', 'reception@thesmileexpert.com', 'SM', '#f97316', 'BBA', '5 years', 'Welcomes patients and manages calendar.', 'Mon,Tue,Wed,Thu,Fri', '09:00-17:00', 'active', 4.70, 'fixed', 65000, 0, '{}', 'receptionist', 'reception@thesmileexpert.com', 'ready'),
('s005', 'clinic-smile-expert-001', 'branch-smile-expert-main', 'Usman Ali', 'Dental Assistant', 'Chairside Assistant', 'dental', '+92 300 5555555', 'usman@thesmileexpert.com', 'UA', '#14b8a6', 'Dental Assistant Diploma', '4 years', 'Supports dentist chairside.', 'Mon,Tue,Wed,Thu,Fri', '09:00-17:00', 'active', 4.60, 'fixed', 55000, 0, '{}', 'staff', 'usman@thesmileexpert.com', 'ready'),
('s006', 'clinic-smile-expert-001', 'branch-smile-expert-main', 'Nida Farooq', 'Manager', 'Clinic Operations', 'dental', '+92 300 6666666', 'manager@thesmileexpert.com', 'NF', '#64748b', 'MBA Healthcare', '7 years', 'Manages daily operations and billing.', 'Mon,Tue,Wed,Thu,Fri', '09:00-17:00', 'active', 4.70, 'fixed', 110000, 0, '{}', 'owner', 'manager@thesmileexpert.com', 'ready');

-- 5. Services
INSERT INTO `Service` (`id`, `clinicId`, `name`, `specialty`, `category`, `price`, `duration`, `popular`, `isActive`) VALUES
('srv001', 'clinic-smile-expert-001', 'Dental Consultation', 'dental', 'Consultation', 2500, 30, 1, 1),
('srv002', 'clinic-smile-expert-001', 'Scaling & Polishing', 'dental', 'Preventive', 6000, 45, 1, 1),
('srv003', 'clinic-smile-expert-001', 'Teeth Whitening', 'dental', 'Cosmetic', 18000, 75, 1, 1),
('srv004', 'clinic-smile-expert-001', 'Composite Filling', 'dental', 'Restorative', 8500, 45, 1, 1),
('srv005', 'clinic-smile-expert-001', 'Root Canal Treatment', 'dental', 'Endodontics', 22000, 90, 1, 1),
('srv006', 'clinic-smile-expert-001', 'Zirconia Crown', 'dental', 'Prosthodontics', 32000, 60, 1, 1),
('srv007', 'clinic-smile-expert-001', 'Smile Design Veneers', 'dental', 'Cosmetic', 55000, 90, 1, 1),
('srv008', 'clinic-smile-expert-001', 'Dental Implant', 'dental', 'Implantology', 145000, 120, 1, 1),
('srv009', 'clinic-smile-expert-001', 'Tooth Extraction', 'dental', 'Oral Surgery', 9000, 45, 0, 1),
('srv010', 'clinic-smile-expert-001', 'Wisdom Tooth Surgery', 'dental', 'Oral Surgery', 28000, 90, 1, 1),
('srv011', 'clinic-smile-expert-001', 'Clear Aligners Consultation', 'dental', 'Orthodontics', 3500, 40, 0, 1),
('srv012', 'clinic-smile-expert-001', 'Pediatric Dental Checkup', 'dental', 'Pediatric', 2500, 30, 0, 1);

-- 6. Clients
INSERT INTO `Client` (`id`, `clinicId`, `patientNo`, `name`, `phone`, `email`, `dob`, `gender`, `specialty`, `medicalHistory`, `loyaltyPoints`, `loyaltyTier`, `totalSpent`, `outstandingBalance`, `latestInvoiceNo`, `nextFollowUpDue`, `lastVisit`, `status`, `avatarColor`, `initials`, `notes`) VALUES
('c001', 'clinic-smile-expert-001', 'TSE-0001', 'Ayesha Khan', '+92 300 1234567', 'ayesha.khan@gmail.com', '1990-01-01', 'Not specified', '["dental"]', '["Dental charting completed", "No known drug allergy"]', 1850, 'Gold', 185000, 35000, 'TSE-2026-0445', '2026-05-28', '2026-05-24', 'active', '#0f766e', 'AK', 'Requires soft touch due to low pain threshold.'),
('c002', 'clinic-smile-expert-001', 'TSE-0002', 'Zain Ahmed', '+92 321 9876543', 'zain.ahmed@outlook.com', '1990-01-01', 'Not specified', '["dental"]', '["Dental charting completed", "No known drug allergy"]', 920, 'Silver', 92000, 0, 'TSE-2026-0446', '2026-06-02', '2026-05-24', 'active', '#2563eb', 'ZA', NULL),
('c003', 'clinic-smile-expert-001', 'TSE-0003', 'Farah Siddiqui', '+92 333 5554444', 'farah.s@hotmail.com', '1990-01-01', 'Not specified', '["dental"]', '["Dental charting completed", "No known drug allergy"]', 1240, 'Silver', 124000, 18000, 'TSE-2026-0447', '2026-05-31', '2026-05-24', 'active', '#f97316', 'FS', NULL),
('c004', 'clinic-smile-expert-001', 'TSE-0004', 'Bilal Sheikh', '+92 312 7778899', 'bilal.sheikh@gmail.com', '1990-01-01', 'Not specified', '["dental"]', '["Dental charting completed", "No known drug allergy"]', 3100, 'Gold', 310000, 80000, 'TSE-2026-0448', '2026-06-08', '2026-05-24', 'active', '#0ea5e9', 'BS', 'Hypertensive patient, check BP before procedures.'),
('c005', 'clinic-smile-expert-001', 'TSE-0005', 'Noor Fatima', '+92 345 2223333', 'noor.fatima@yahoo.com', '1990-01-01', 'Not specified', '["dental"]', '["Dental charting completed", "No known drug allergy"]', 550, 'Silver', 55000, 0, 'TSE-2026-0449', '2026-06-12', '2026-05-24', 'active', '#14b8a6', 'NF', NULL);

-- 7. Appointments
INSERT INTO `Appointment` (`id`, `clinicId`, `branchId`, `clientId`, `staffId`, `serviceId`, `date`, `startTime`, `endTime`, `duration`, `status`, `room`, `notes`, `price`, `specialty`, `checkedIn`, `checkinTime`, `qrCode`) VALUES
('a001', 'clinic-smile-expert-001', 'branch-smile-expert-main', 'c001', 's002', 'srv007', '2026-05-24', '11:00', '12:30', 90, 'confirmed', 'Dental Operatory', 'Smile design photos and shade selection', 55000, 'dental', 0, NULL, NULL),
('a002', 'clinic-smile-expert-001', 'branch-smile-expert-main', 'c002', 's003', 'srv005', '2026-05-24', '10:00', '11:30', 90, 'confirmed', 'Dental Operatory', 'Root canal obturation visit', 22000, 'dental', 0, NULL, NULL),
('a003', 'clinic-smile-expert-001', 'branch-smile-expert-main', 'c003', 's002', 'srv003', '2026-05-24', '13:00', '14:15', 75, 'completed', 'Dental Operatory', 'Whitening with sensitivity care', 18000, 'dental', 0, NULL, NULL),
('a004', 'clinic-smile-expert-001', 'branch-smile-expert-main', 'c004', 's001', 'srv008', '2026-05-24', '15:00', '17:00', 120, 'confirmed', 'Dental Operatory', 'Implant planning and CBCT review', 145000, 'dental', 0, NULL, NULL),
('a005', 'clinic-smile-expert-001', 'branch-smile-expert-main', 'c005', 's001', 'srv004', '2026-05-24', '17:15', '18:00', 45, 'confirmed', 'Dental Operatory', 'Composite restoration', 8500, 'dental', 0, NULL, NULL);

-- 8. Invoices
INSERT INTO `Invoice` (`id`, `clinicId`, `clientId`, `appointmentId`, `invoiceNo`, `items`, `subtotal`, `previousBalance`, `discount`, `tax`, `total`, `grandTotal`, `amountPaid`, `balanceDue`, `status`, `paymentMethod`) VALUES
('inv001', 'clinic-smile-expert-001', 'c001', 'a001', 'TSE-2026-0445', '[{"name":"Smile Design Veneers","qty":1,"unitPrice":55000,"total":55000}]', 55000, 0, 0, 0, 55000, 55000, 20000, 35000, 'pending', 'Cash'),
('inv002', 'clinic-smile-expert-001', 'c002', 'a002', 'TSE-2026-0446', '[{"name":"Root Canal Treatment","qty":1,"unitPrice":22000,"total":22000}]', 22000, 0, 0, 0, 22000, 22000, 22000, 0, 'paid', 'Cash'),
('inv003', 'clinic-smile-expert-001', 'c003', 'a003', 'TSE-2026-0447', '[{"name":"Teeth Whitening","qty":1,"unitPrice":18000,"total":18000}]', 18000, 0, 0, 0, 18000, 18000, 0, 18000, 'pending', NULL),
('inv004', 'clinic-smile-expert-001', 'c004', 'a004', 'TSE-2026-0448', '[{"name":"Dental Implant","qty":1,"unitPrice":145000,"total":145000}]', 145000, 0, 0, 0, 145000, 145000, 65000, 80000, 'pending', 'Cash'),
('inv005', 'clinic-smile-expert-001', 'c005', 'a005', 'TSE-2026-0449', '[{"name":"Composite Filling","qty":1,"unitPrice":8500,"total":8500}]', 8500, 0, 0, 0, 8500, 8500, 8500, 0, 'paid', 'Cash');

-- 9. Inventory
INSERT INTO `InventoryItem` (`id`, `clinicId`, `name`, `category`, `specialty`, `quantity`, `unit`, `reorderLevel`, `costPerUnit`, `supplier`) VALUES
('inv-d001', 'clinic-smile-expert-001', 'Composite Resin', 'Restorative', 'dental', 50, 'syringes', 10, 800, 'Dental Supply Partner'),
('inv-d002', 'clinic-smile-expert-001', 'Impression Material', 'Diagnostic', 'dental', 8, 'packs', 10, 1200, 'Dental Supply Partner'),
('inv-d003', 'clinic-smile-expert-001', 'Lidocaine Anesthetic', 'Anesthesia', 'dental', 30, 'vials', 15, 350, 'Dental Supply Partner'),
('inv-d004', 'clinic-smile-expert-001', 'Endodontic Files', 'Endodontics', 'dental', 18, 'packs', 8, 1800, 'Dental Supply Partner'),
('inv-d005', 'clinic-smile-expert-001', 'Surgical Sutures', 'Oral Surgery', 'dental', 24, 'packs', 12, 950, 'Dental Supply Partner'),
('inv-d006', 'clinic-smile-expert-001', 'Implant Fixture Kit', 'Implantology', 'dental', 6, 'kits', 4, 42000, 'Dental Supply Partner'),
('inv-g001', 'clinic-smile-expert-001', 'Nitrile Gloves', 'PPE', 'dental', 250, 'pairs', 50, 45, 'Dental Supply Partner'),
('inv-g002', 'clinic-smile-expert-001', 'Surgical Masks', 'PPE', 'dental', 180, 'pcs', 100, 25, 'Dental Supply Partner');

-- 10. Packages
INSERT INTO `Package` (`id`, `clinicId`, `name`, `description`, `totalPrice`, `validity`, `specialty`, `isActive`) VALUES
('pkg001', 'clinic-smile-expert-001', 'Dental Care Pack', 'Consultation, scaling, polishing, and one follow-up hygiene review.', 12000, 180, 'dental', 1),
('pkg002', 'clinic-smile-expert-001', 'Smile Whitening Plan', 'Whitening session with shade documentation and sensitivity kit.', 22000, 90, 'dental', 1),
('pkg003', 'clinic-smile-expert-001', 'Root Canal + Crown Plan', 'Root canal treatment, core build-up, and zirconia crown workflow.', 52000, 120, 'dental', 1),
('pkg004', 'clinic-smile-expert-001', 'Implant Journey Plan', 'Implant consultation, surgical placement, review, and prosthetic appointment.', 145000, 365, 'dental', 1);

-- 11. Client Package purchase
INSERT INTO `ClientPackage` (`id`, `clientId`, `packageId`, `purchaseDate`, `expiryDate`, `totalSessions`, `usedSessions`, `status`, `amountPaid`) VALUES
('cp001', 'c001', 'pkg002', '2026-05-10', '2026-08-10', 2, 1, 'active', 22000);

-- 12. Feedback
INSERT INTO `Feedback` (`id`, `clinicId`, `clientId`, `appointmentId`, `staffRating`, `serviceRating`, `overallRating`, `comment`, `wouldRecommend`, `isPublic`, `staffId`) VALUES
('fb001', 'clinic-smile-expert-001', 'c001', 'a001', 5, 5, 5, 'The smile design preview was excellent and the team explained every step.', 1, 1, 's002'),
('fb002', 'clinic-smile-expert-001', 'c002', 'a002', 5, 5, 5, 'Root canal was comfortable and clearly managed.', 1, 1, 's003'),
('fb003', 'clinic-smile-expert-001', 'c003', 'a003', 5, 5, 5, 'Whitening result was bright and natural.', 1, 1, 's002');

-- 13. Campaign
INSERT INTO `Campaign` (`id`, `clinicId`, `name`, `type`, `trigger`, `body`, `status`, `sentCount`, `openCount`) VALUES
('cmp001', 'clinic-smile-expert-001', 'Monthly Recall', 'whatsapp', 'manual', 'Hi {{name}}, your dental follow-up is due. Reply 1 to book your appointment with The Smile Expert.', 'active', 124, 96),
('cmp002', 'clinic-smile-expert-001', 'Appointment Reminder', 'sms', 'appointment_reminder', 'Reminder: your appointment at The Smile Expert is tomorrow. Reply C to confirm or R to reschedule.', 'active', 240, 210),
('cmp003', 'clinic-smile-expert-001', 'Whitening Follow-up', 'whatsapp', 'aftercare', 'Hi {{name}}, avoid tea, coffee, and colored foods for 24 hours after whitening. Contact us if you feel sensitivity.', 'active', 58, 52);

-- 14. AuditLog
INSERT INTO `AuditLog` (`id`, `clinicId`, `userId`, `action`, `entity`, `entityId`, `newData`, `ip`, `userAgent`) VALUES
('ad001', 'clinic-smile-expert-001', 'u001', 'LOGIN', 'User', 'owner@thesmileexpert.com', '{"role":"owner"}', '192.168.1.1', 'Seed Script'),
('ad002', 'clinic-smile-expert-001', 'u001', 'CREATE', 'Appointment', 'a001', '{"clientId":"c001","service":"Smile Design Veneers"}', '192.168.1.1', 'Seed Script'),
('ad003', 'clinic-smile-expert-001', 'u001', 'UPDATE', 'Invoice', 'TSE-2026-0445', '{"status":"partial","balanceDue":35000}', '192.168.1.1', 'Seed Script'),
('ad004', 'clinic-smile-expert-001', 'u001', 'CREATE', 'Staff', 's005', '{"name":"Usman Ali","role":"Dental Assistant"}', '192.168.1.1', 'Seed Script');
