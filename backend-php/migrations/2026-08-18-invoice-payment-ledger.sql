-- Cash-basis invoice payment ledger. Each payment/refund is attributed to the
-- date it happened instead of the date its invoice was originally created.

CREATE TABLE IF NOT EXISTS `InvoicePaymentEntry` (
  `id` VARCHAR(36) NOT NULL,
  `clinicId` VARCHAR(36) NOT NULL,
  `invoiceId` VARCHAR(36) NOT NULL,
  `clientId` VARCHAR(36) NOT NULL,
  `amount` DOUBLE NOT NULL,
  `type` VARCHAR(30) NOT NULL DEFAULT 'payment',
  `paymentMethod` VARCHAR(100) DEFAULT NULL,
  `paidAt` DATETIME NOT NULL,
  `createdBy` VARCHAR(36) DEFAULT NULL,
  `notes` VARCHAR(255) DEFAULT NULL,
  `sourceKey` VARCHAR(120) DEFAULT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_InvoicePayment_Source` (`clinicId`, `sourceKey`),
  KEY `IX_InvoicePayment_Clinic_Date` (`clinicId`, `paidAt`),
  KEY `IX_InvoicePayment_Invoice_Date` (`invoiceId`, `paidAt`),
  KEY `IX_InvoicePayment_Client_Date` (`clientId`, `paidAt`),
  CONSTRAINT `FK_InvoicePayment_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_InvoicePayment_Invoice` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_InvoicePayment_Client` FOREIGN KEY (`clientId`) REFERENCES `Client` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_InvoicePayment_User` FOREIGN KEY (`createdBy`) REFERENCES `User` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `InvoicePaymentEntry`
  (`id`, `clinicId`, `invoiceId`, `clientId`, `amount`, `type`, `paymentMethod`, `paidAt`, `sourceKey`)
SELECT UUID(), i.`clinicId`, i.`id`, i.`clientId`, i.`amountPaid`, 'legacy', i.`paymentMethod`,
       COALESCE(i.`paidAt`, i.`createdAt`), CONCAT('legacy:', i.`id`)
FROM `Invoice` i
WHERE i.`amountPaid` > 0 AND i.`status` NOT IN ('refunded', 'cancelled');
