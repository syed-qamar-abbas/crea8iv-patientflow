<?php
require_once __DIR__ . '/../helpers.php';

function pf_finance_role($user) {
    return normalize_clinic_role($user['role'] ?? '');
}

function pf_can_view_business_financials($user) {
    return in_array(pf_finance_role($user), ['owner', 'manager', 'accountant'], true);
}

function pf_can_manage_expenses($user) {
    return pf_can_view_business_financials($user);
}

function pf_can_manage_procedure_costs($user) {
    return pf_can_view_business_financials($user);
}

function pf_default_expense_categories() {
    return ['Rent', 'Electricity', 'Water', 'Gas', 'Internet', 'Salaries', 'Supplies', 'Miscellaneous'];
}

function pf_dental_financials_ensure($db) {
    if (DB_DRIVER === 'sqlite') {
        $db->exec("CREATE TABLE IF NOT EXISTS ExpenseCategory (
            id TEXT PRIMARY KEY, clinicId TEXT NOT NULL, name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'general', isActive INTEGER NOT NULL DEFAULT 1,
            createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (clinicId, name)
        )");
        $db->exec("CREATE INDEX IF NOT EXISTS IX_ExpenseCategory_Clinic_Active ON ExpenseCategory (clinicId, isActive)");
        $db->exec("CREATE TABLE IF NOT EXISTS Expense (
            id TEXT PRIMARY KEY, clinicId TEXT NOT NULL, branchId TEXT DEFAULT NULL,
            categoryId TEXT DEFAULT NULL, description TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0,
            expenseDate TEXT NOT NULL, paymentMethod TEXT DEFAULT NULL, receiptUrl TEXT DEFAULT NULL,
            createdBy TEXT DEFAULT NULL, archivedAt TEXT DEFAULT NULL,
            createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )");
        $db->exec("CREATE INDEX IF NOT EXISTS IX_Expense_Clinic_Date ON Expense (clinicId, expenseDate)");
        $db->exec("CREATE INDEX IF NOT EXISTS IX_Expense_Clinic_Category ON Expense (clinicId, categoryId, expenseDate)");
        $db->exec("CREATE INDEX IF NOT EXISTS IX_Expense_Clinic_Branch ON Expense (clinicId, branchId, expenseDate)");
        $db->exec("CREATE TABLE IF NOT EXISTS RecurringExpense (
            id TEXT PRIMARY KEY, clinicId TEXT NOT NULL, branchId TEXT DEFAULT NULL,
            categoryId TEXT DEFAULT NULL, description TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0,
            frequency TEXT NOT NULL DEFAULT 'monthly', dueDay INTEGER NOT NULL DEFAULT 1,
            paymentMethod TEXT DEFAULT NULL, isActive INTEGER NOT NULL DEFAULT 1,
            lastPostedMonth TEXT DEFAULT NULL, lastPostedAt TEXT DEFAULT NULL,
            createdBy TEXT DEFAULT NULL, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )");
        $db->exec("CREATE INDEX IF NOT EXISTS IX_RecurringExpense_Clinic_Active_Due ON RecurringExpense (clinicId, isActive, dueDay)");
        $db->exec("CREATE INDEX IF NOT EXISTS IX_RecurringExpense_Clinic_Category ON RecurringExpense (clinicId, categoryId)");
        $db->exec("CREATE TABLE IF NOT EXISTS InvoiceProcedureCost (
            id TEXT PRIMARY KEY, clinicId TEXT NOT NULL, invoiceId TEXT NOT NULL,
            invoiceItemIndex INTEGER NOT NULL DEFAULT 0, appointmentId TEXT DEFAULT NULL,
            clientId TEXT NOT NULL, serviceId TEXT DEFAULT NULL, patientCharge REAL NOT NULL DEFAULT 0,
            procedureCost REAL NOT NULL DEFAULT 0, notes TEXT DEFAULT NULL, createdBy TEXT DEFAULT NULL,
            updatedBy TEXT DEFAULT NULL, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (clinicId, invoiceId, invoiceItemIndex)
        )");
        $db->exec("CREATE INDEX IF NOT EXISTS IX_ProcedureCost_Clinic_Service ON InvoiceProcedureCost (clinicId, serviceId)");
        $db->exec("CREATE INDEX IF NOT EXISTS IX_ProcedureCost_Clinic_Client ON InvoiceProcedureCost (clinicId, clientId)");
        $db->exec("CREATE TABLE IF NOT EXISTS TreatmentProcedureDetail (
            id TEXT PRIMARY KEY, clinicId TEXT NOT NULL, clientId TEXT NOT NULL,
            appointmentId TEXT DEFAULT NULL, invoiceId TEXT DEFAULT NULL, serviceId TEXT DEFAULT NULL,
            staffId TEXT DEFAULT NULL, procedureType TEXT NOT NULL, toothNumber TEXT DEFAULT NULL,
            jaw TEXT DEFAULT NULL, side TEXT DEFAULT NULL, canalType TEXT DEFAULT NULL,
            extractionType TEXT DEFAULT NULL, crownMaterial TEXT DEFAULT NULL, notes TEXT DEFAULT NULL,
            followUpDate TEXT DEFAULT NULL, performedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            createdBy TEXT DEFAULT NULL, archivedAt TEXT DEFAULT NULL,
            createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )");
        $db->exec("CREATE INDEX IF NOT EXISTS IX_TreatmentDetail_Clinic_Client_Date ON TreatmentProcedureDetail (clinicId, clientId, performedAt)");
        $db->exec("CREATE INDEX IF NOT EXISTS IX_TreatmentDetail_Clinic_Staff_Date ON TreatmentProcedureDetail (clinicId, staffId, performedAt)");
        try { $db->exec("ALTER TABLE Service ADD COLUMN defaultProcedureCost REAL DEFAULT NULL"); } catch (Exception $ignored) {}
        try { $db->exec("ALTER TABLE TreatmentProcedureDetail ADD COLUMN status TEXT DEFAULT 'completed'"); } catch (Exception $ignored) {}
        try { $db->exec("ALTER TABLE TreatmentProcedureDetail ADD COLUMN cost REAL DEFAULT 0"); } catch (Exception $ignored) {}
        return;
    }

    $db->exec("CREATE TABLE IF NOT EXISTS `ExpenseCategory` (
        `id` VARCHAR(36) NOT NULL, `clinicId` VARCHAR(36) NOT NULL, `name` VARCHAR(120) NOT NULL,
        `type` VARCHAR(40) NOT NULL DEFAULT 'general', `isActive` TINYINT(1) NOT NULL DEFAULT 1,
        `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`), UNIQUE KEY `UK_ExpenseCategory_Clinic_Name` (`clinicId`, `name`),
        KEY `IX_ExpenseCategory_Clinic_Active` (`clinicId`, `isActive`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS `Expense` (
        `id` VARCHAR(36) NOT NULL, `clinicId` VARCHAR(36) NOT NULL, `branchId` VARCHAR(36) DEFAULT NULL,
        `categoryId` VARCHAR(36) DEFAULT NULL, `description` VARCHAR(255) NOT NULL,
        `amount` DOUBLE NOT NULL DEFAULT 0, `expenseDate` DATE NOT NULL,
        `paymentMethod` VARCHAR(100) DEFAULT NULL, `receiptUrl` TEXT DEFAULT NULL,
        `createdBy` VARCHAR(36) DEFAULT NULL, `archivedAt` DATETIME DEFAULT NULL,
        `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`), KEY `IX_Expense_Clinic_Date` (`clinicId`, `expenseDate`),
        KEY `IX_Expense_Clinic_Category` (`clinicId`, `categoryId`, `expenseDate`),
        KEY `IX_Expense_Clinic_Branch` (`clinicId`, `branchId`, `expenseDate`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS `RecurringExpense` (
        `id` VARCHAR(36) NOT NULL, `clinicId` VARCHAR(36) NOT NULL, `branchId` VARCHAR(36) DEFAULT NULL,
        `categoryId` VARCHAR(36) DEFAULT NULL, `description` VARCHAR(255) NOT NULL,
        `amount` DOUBLE NOT NULL DEFAULT 0, `frequency` VARCHAR(30) NOT NULL DEFAULT 'monthly',
        `dueDay` INT NOT NULL DEFAULT 1, `paymentMethod` VARCHAR(100) DEFAULT NULL,
        `isActive` TINYINT(1) NOT NULL DEFAULT 1, `lastPostedMonth` VARCHAR(7) DEFAULT NULL,
        `lastPostedAt` DATETIME DEFAULT NULL, `createdBy` VARCHAR(36) DEFAULT NULL,
        `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`), KEY `IX_RecurringExpense_Clinic_Active_Due` (`clinicId`, `isActive`, `dueDay`),
        KEY `IX_RecurringExpense_Clinic_Category` (`clinicId`, `categoryId`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS `InvoiceProcedureCost` (
        `id` VARCHAR(36) NOT NULL, `clinicId` VARCHAR(36) NOT NULL, `invoiceId` VARCHAR(36) NOT NULL,
        `invoiceItemIndex` INT NOT NULL DEFAULT 0, `appointmentId` VARCHAR(36) DEFAULT NULL,
        `clientId` VARCHAR(36) NOT NULL, `serviceId` VARCHAR(36) DEFAULT NULL,
        `patientCharge` DOUBLE NOT NULL DEFAULT 0, `procedureCost` DOUBLE NOT NULL DEFAULT 0,
        `notes` TEXT DEFAULT NULL, `createdBy` VARCHAR(36) DEFAULT NULL, `updatedBy` VARCHAR(36) DEFAULT NULL,
        `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`), UNIQUE KEY `UK_ProcedureCost_Invoice_Item` (`clinicId`, `invoiceId`, `invoiceItemIndex`),
        KEY `IX_ProcedureCost_Clinic_Service` (`clinicId`, `serviceId`),
        KEY `IX_ProcedureCost_Clinic_Client` (`clinicId`, `clientId`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS `TreatmentProcedureDetail` (
        `id` VARCHAR(36) NOT NULL, `clinicId` VARCHAR(36) NOT NULL, `clientId` VARCHAR(36) NOT NULL,
        `appointmentId` VARCHAR(36) DEFAULT NULL, `invoiceId` VARCHAR(36) DEFAULT NULL,
        `serviceId` VARCHAR(36) DEFAULT NULL, `staffId` VARCHAR(36) DEFAULT NULL,
        `procedureType` VARCHAR(120) NOT NULL, `toothNumber` VARCHAR(40) DEFAULT NULL,
        `jaw` VARCHAR(20) DEFAULT NULL, `side` VARCHAR(20) DEFAULT NULL, `canalType` VARCHAR(80) DEFAULT NULL,
        `extractionType` VARCHAR(80) DEFAULT NULL, `crownMaterial` VARCHAR(120) DEFAULT NULL,
        `notes` TEXT DEFAULT NULL, `followUpDate` DATE DEFAULT NULL,
        `performedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `createdBy` VARCHAR(36) DEFAULT NULL, `archivedAt` DATETIME DEFAULT NULL,
        `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`), KEY `IX_TreatmentDetail_Clinic_Client_Date` (`clinicId`, `clientId`, `performedAt`),
        KEY `IX_TreatmentDetail_Clinic_Staff_Date` (`clinicId`, `staffId`, `performedAt`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    try { $db->exec("ALTER TABLE `Service` ADD COLUMN `defaultProcedureCost` DOUBLE DEFAULT NULL"); } catch (Exception $ignored) {}
    try { $db->exec("ALTER TABLE `TreatmentProcedureDetail` ADD COLUMN `status` VARCHAR(30) DEFAULT 'completed'"); } catch (Exception $ignored) {}
    try { $db->exec("ALTER TABLE `TreatmentProcedureDetail` ADD COLUMN `cost` DOUBLE DEFAULT 0"); } catch (Exception $ignored) {}
}

function pf_seed_expense_categories($db, $clinicId) {
    $existing = $db->prepare("SELECT COUNT(*) FROM ExpenseCategory WHERE clinicId = ?");
    $existing->execute([$clinicId]);
    if (intval($existing->fetchColumn()) > 0) return;

    $stmt = $db->prepare("INSERT INTO ExpenseCategory (id, clinicId, name, type, isActive) VALUES (?, ?, ?, 'general', 1)");
    foreach (pf_default_expense_categories() as $name) {
        try { $stmt->execute([generate_uuid(), $clinicId, $name]); } catch (Exception $ignored) {}
    }
}

function pf_valid_date($value) {
    return preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$value) === 1;
}
