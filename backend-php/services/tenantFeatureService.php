<?php
require_once __DIR__ . '/industryTemplateService.php';

function tenant_features_ensure($db) {
    $columns = [
        'operatingMode' => ['sqlite' => "TEXT NOT NULL DEFAULT 'operations_only'", 'mysql' => "VARCHAR(40) NOT NULL DEFAULT 'operations_only'"],
        'clinicalRecordEnabled' => ['sqlite' => 'INTEGER NOT NULL DEFAULT 0', 'mysql' => 'TINYINT NOT NULL DEFAULT 0'],
        'treatmentProcedureEntryEnabled' => ['sqlite' => 'INTEGER NOT NULL DEFAULT 0', 'mysql' => 'TINYINT NOT NULL DEFAULT 0'],
        'medicalHistoryEntryEnabled' => ['sqlite' => 'INTEGER NOT NULL DEFAULT 0', 'mysql' => 'TINYINT NOT NULL DEFAULT 0'],
        'patientImagePublicationEnabled' => ['sqlite' => 'INTEGER NOT NULL DEFAULT 0', 'mysql' => 'TINYINT NOT NULL DEFAULT 0'],
        'aiClinicalAdviceEnabled' => ['sqlite' => 'INTEGER NOT NULL DEFAULT 0', 'mysql' => 'TINYINT NOT NULL DEFAULT 0'],
        'clinicalPolicyVersion' => ['sqlite' => "TEXT NOT NULL DEFAULT 'operations-v1'", 'mysql' => "VARCHAR(40) NOT NULL DEFAULT 'operations-v1'"],
        'marketingEnabled' => ['sqlite' => 'INTEGER DEFAULT 0', 'mysql' => 'TINYINT DEFAULT 0'],
        'metaLeadsEnabled' => ['sqlite' => 'INTEGER DEFAULT 0', 'mysql' => 'TINYINT DEFAULT 0'],
        'importsEnabled' => ['sqlite' => 'INTEGER DEFAULT 0', 'mysql' => 'TINYINT DEFAULT 0'],
        // Phase 4: AI Receptionist may auto-create appointments from chat (opt-in, default off).
        'aiAutoBookEnabled' => ['sqlite' => 'INTEGER DEFAULT 0', 'mysql' => 'TINYINT DEFAULT 0'],
        'industryTemplate' => ['sqlite' => 'TEXT DEFAULT NULL', 'mysql' => 'VARCHAR(80) DEFAULT NULL'],
    ];
    industry_templates_ensure($db);
    if (DB_DRIVER === 'sqlite') {
        $db->exec("CREATE TABLE IF NOT EXISTS ClinicFeatureSetting (
            clinicId TEXT PRIMARY KEY,
            industryTemplate TEXT DEFAULT NULL,
            operatingMode TEXT NOT NULL DEFAULT 'operations_only',
            clinicalRecordEnabled INTEGER NOT NULL DEFAULT 0,
            treatmentProcedureEntryEnabled INTEGER NOT NULL DEFAULT 0,
            medicalHistoryEntryEnabled INTEGER NOT NULL DEFAULT 0,
            patientImagePublicationEnabled INTEGER NOT NULL DEFAULT 0,
            aiClinicalAdviceEnabled INTEGER NOT NULL DEFAULT 0,
            clinicalPolicyVersion TEXT NOT NULL DEFAULT 'operations-v1',
            marketingEnabled INTEGER DEFAULT 0,
            metaLeadsEnabled INTEGER DEFAULT 0,
            importsEnabled INTEGER DEFAULT 0,
            whatsappEnabled INTEGER DEFAULT 0,
            whatsappMarketingEnabled INTEGER DEFAULT 0,
            whatsappAutomationEnabled INTEGER DEFAULT 0,
            aiEnabled INTEGER DEFAULT 0,
            aiAutoReplyEnabled INTEGER DEFAULT 0,
            aiAutoBookEnabled INTEGER DEFAULT 0,
            aiHumanApprovalRequired INTEGER DEFAULT 1,
            monthlyAiTokenLimit INTEGER DEFAULT 0,
            monthlyWhatsAppLimit INTEGER DEFAULT 0,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )");
        $cols = $db->query("PRAGMA table_info(ClinicFeatureSetting)")->fetchAll();
        $names = array_column($cols, 'name');
        foreach ($columns as $name => $types) {
            if (!in_array($name, $names, true)) {
                $db->exec("ALTER TABLE ClinicFeatureSetting ADD COLUMN $name {$types['sqlite']}");
            }
        }
    } else {
        $db->exec("CREATE TABLE IF NOT EXISTS ClinicFeatureSetting (
            clinicId VARCHAR(64) PRIMARY KEY,
            industryTemplate VARCHAR(80) DEFAULT NULL,
            operatingMode VARCHAR(40) NOT NULL DEFAULT 'operations_only',
            clinicalRecordEnabled TINYINT NOT NULL DEFAULT 0,
            treatmentProcedureEntryEnabled TINYINT NOT NULL DEFAULT 0,
            medicalHistoryEntryEnabled TINYINT NOT NULL DEFAULT 0,
            patientImagePublicationEnabled TINYINT NOT NULL DEFAULT 0,
            aiClinicalAdviceEnabled TINYINT NOT NULL DEFAULT 0,
            clinicalPolicyVersion VARCHAR(40) NOT NULL DEFAULT 'operations-v1',
            marketingEnabled TINYINT DEFAULT 0,
            metaLeadsEnabled TINYINT DEFAULT 0,
            importsEnabled TINYINT DEFAULT 0,
            whatsappEnabled TINYINT DEFAULT 0,
            whatsappMarketingEnabled TINYINT DEFAULT 0,
            whatsappAutomationEnabled TINYINT DEFAULT 0,
            aiEnabled TINYINT DEFAULT 0,
            aiAutoReplyEnabled TINYINT DEFAULT 0,
            aiAutoBookEnabled TINYINT DEFAULT 0,
            aiHumanApprovalRequired TINYINT DEFAULT 1,
            monthlyAiTokenLimit INT DEFAULT 0,
            monthlyWhatsAppLimit INT DEFAULT 0,
            updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT FK_ClinicFeatureSetting_Clinic FOREIGN KEY (clinicId) REFERENCES Clinic(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        foreach ($columns as $name => $types) {
            $stmt = $db->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ClinicFeatureSetting' AND COLUMN_NAME = ?");
            $stmt->execute([$name]);
            if (!(int)$stmt->fetchColumn()) {
                $db->exec("ALTER TABLE ClinicFeatureSetting ADD COLUMN $name {$types['mysql']}");
            }
        }
    }
}

function tenant_features_defaults($clinicId) {
    return [
        'clinicId' => $clinicId,
        'industryTemplate' => INDUSTRY_TEMPLATE_DEFAULT,
        'operatingMode' => 'operations_only',
        'clinicalRecordEnabled' => 0,
        'treatmentProcedureEntryEnabled' => 0,
        'medicalHistoryEntryEnabled' => 0,
        'patientImagePublicationEnabled' => 0,
        'aiClinicalAdviceEnabled' => 0,
        'clinicalPolicyVersion' => 'operations-v1',
        'marketingEnabled' => 0,
        'metaLeadsEnabled' => 0,
        'importsEnabled' => 0,
        'whatsappEnabled' => 0,
        'whatsappMarketingEnabled' => 0,
        'whatsappAutomationEnabled' => 0,
        'aiEnabled' => 0,
        'aiAutoReplyEnabled' => 0,
        'aiAutoBookEnabled' => 0,
        'aiHumanApprovalRequired' => 1,
        'monthlyAiTokenLimit' => 0,
        'monthlyWhatsAppLimit' => 0,
    ];
}

function tenant_features_get($db, $clinicId) {
    tenant_features_ensure($db);
    $stmt = $db->prepare("SELECT * FROM ClinicFeatureSetting WHERE clinicId = ?");
    $stmt->execute([$clinicId]);
    $row = $stmt->fetch();
    if (!$row) return tenant_features_defaults($clinicId);
    $merged = array_merge(tenant_features_defaults($clinicId), $row);
    if (empty($merged['industryTemplate'])) $merged['industryTemplate'] = INDUSTRY_TEMPLATE_DEFAULT;
    // P0-2 Phase A is a hard product boundary, not a tenant-configurable flag.
    // Keep every code path fail-closed even if a database value is changed
    // manually or arrives through a future admin/package payload.
    $merged['operatingMode'] = 'operations_only';
    $merged['clinicalRecordEnabled'] = 0;
    $merged['treatmentProcedureEntryEnabled'] = 0;
    $merged['medicalHistoryEntryEnabled'] = 0;
    $merged['patientImagePublicationEnabled'] = 0;
    $merged['aiClinicalAdviceEnabled'] = 0;
    $merged['clinicalPolicyVersion'] = 'operations-v1';
    return $merged;
}

function tenant_features_save($db, $clinicId, $input) {
    tenant_features_ensure($db);
    $current = tenant_features_get($db, $clinicId);
    $boolValue = function($key, $default = 0) use ($input, $current) {
        if (array_key_exists($key, $input)) return !empty($input[$key]) ? 1 : 0;
        return !empty($current[$key] ?? $default) ? 1 : 0;
    };
    $industryTemplate = $current['industryTemplate'] ?? INDUSTRY_TEMPLATE_DEFAULT;
    if (array_key_exists('industryTemplate', $input)) {
        $industryTemplate = industry_template_normalize($input['industryTemplate']);
        if (!industry_template_exists($db, $industryTemplate)) {
            throw new Exception('Invalid industry template');
        }
    }

    $data = array_merge($current, [
        'industryTemplate' => $industryTemplate,
        'marketingEnabled' => $boolValue('marketingEnabled'),
        'metaLeadsEnabled' => $boolValue('metaLeadsEnabled'),
        'importsEnabled' => $boolValue('importsEnabled'),
        'whatsappEnabled' => $boolValue('whatsappEnabled'),
        'whatsappMarketingEnabled' => $boolValue('whatsappMarketingEnabled'),
        'whatsappAutomationEnabled' => $boolValue('whatsappAutomationEnabled'),
        'aiEnabled' => $boolValue('aiEnabled'),
        'aiAutoReplyEnabled' => $boolValue('aiAutoReplyEnabled'),
        'aiAutoBookEnabled' => $boolValue('aiAutoBookEnabled'),
        'aiHumanApprovalRequired' => $boolValue('aiHumanApprovalRequired', 1),
        'monthlyAiTokenLimit' => max(0, intval($input['monthlyAiTokenLimit'] ?? $current['monthlyAiTokenLimit'] ?? 0)),
        'monthlyWhatsAppLimit' => max(0, intval($input['monthlyWhatsAppLimit'] ?? $current['monthlyWhatsAppLimit'] ?? 0)),
    ]);

    if (DB_DRIVER === 'sqlite') {
        $sql = "INSERT INTO ClinicFeatureSetting (clinicId, industryTemplate, marketingEnabled, metaLeadsEnabled, importsEnabled, whatsappEnabled, whatsappMarketingEnabled, whatsappAutomationEnabled, aiEnabled, aiAutoReplyEnabled, aiAutoBookEnabled, aiHumanApprovalRequired, monthlyAiTokenLimit, monthlyWhatsAppLimit)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(clinicId) DO UPDATE SET industryTemplate=excluded.industryTemplate, marketingEnabled=excluded.marketingEnabled, metaLeadsEnabled=excluded.metaLeadsEnabled, importsEnabled=excluded.importsEnabled, whatsappEnabled=excluded.whatsappEnabled, whatsappMarketingEnabled=excluded.whatsappMarketingEnabled, whatsappAutomationEnabled=excluded.whatsappAutomationEnabled, aiEnabled=excluded.aiEnabled, aiAutoReplyEnabled=excluded.aiAutoReplyEnabled, aiAutoBookEnabled=excluded.aiAutoBookEnabled, aiHumanApprovalRequired=excluded.aiHumanApprovalRequired, monthlyAiTokenLimit=excluded.monthlyAiTokenLimit, monthlyWhatsAppLimit=excluded.monthlyWhatsAppLimit, updatedAt=CURRENT_TIMESTAMP";
    } else {
        $sql = "INSERT INTO ClinicFeatureSetting (clinicId, industryTemplate, marketingEnabled, metaLeadsEnabled, importsEnabled, whatsappEnabled, whatsappMarketingEnabled, whatsappAutomationEnabled, aiEnabled, aiAutoReplyEnabled, aiAutoBookEnabled, aiHumanApprovalRequired, monthlyAiTokenLimit, monthlyWhatsAppLimit)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE industryTemplate=VALUES(industryTemplate), marketingEnabled=VALUES(marketingEnabled), metaLeadsEnabled=VALUES(metaLeadsEnabled), importsEnabled=VALUES(importsEnabled), whatsappEnabled=VALUES(whatsappEnabled), whatsappMarketingEnabled=VALUES(whatsappMarketingEnabled), whatsappAutomationEnabled=VALUES(whatsappAutomationEnabled), aiEnabled=VALUES(aiEnabled), aiAutoReplyEnabled=VALUES(aiAutoReplyEnabled), aiAutoBookEnabled=VALUES(aiAutoBookEnabled), aiHumanApprovalRequired=VALUES(aiHumanApprovalRequired), monthlyAiTokenLimit=VALUES(monthlyAiTokenLimit), monthlyWhatsAppLimit=VALUES(monthlyWhatsAppLimit), updatedAt=CURRENT_TIMESTAMP";
    }
    $db->prepare($sql)->execute([
        $clinicId,
        $data['industryTemplate'],
        $data['marketingEnabled'],
        $data['metaLeadsEnabled'],
        $data['importsEnabled'],
        $data['whatsappEnabled'],
        $data['whatsappMarketingEnabled'],
        $data['whatsappAutomationEnabled'],
        $data['aiEnabled'],
        $data['aiAutoReplyEnabled'],
        $data['aiAutoBookEnabled'],
        $data['aiHumanApprovalRequired'],
        $data['monthlyAiTokenLimit'],
        $data['monthlyWhatsAppLimit'],
    ]);
    return tenant_features_get($db, $clinicId);
}

function tenant_feature_bool($features, $key) {
    return !empty($features[$key]);
}
