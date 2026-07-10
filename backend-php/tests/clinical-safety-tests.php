<?php
// Focused P0-2 tests for the operations-only product safety boundary.

error_reporting(E_ALL);
putenv('APP_ENV=development');
putenv('DB_DRIVER=sqlite');
putenv('DB_PATH=:memory:');
putenv('JWT_SECRET=test-secret-please-ignore-0123456789abcdef');
putenv('JWT_REFRESH_SECRET=test-refresh-secret-0123456789abcdef00');

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../services/clinicalSafetyPolicyService.php';

$pass = 0;
$fail = 0;
$failures = [];

function safety_check($name, $condition) {
    global $pass, $fail, $failures;
    if ($condition) {
        $pass++;
        echo "  ok  $name\n";
    } else {
        $fail++;
        $failures[] = $name;
        echo "FAIL  $name\n";
    }
}

$db = DB::getConnection();
$db->exec("CREATE TABLE Clinic (id TEXT PRIMARY KEY)");
$db->exec("CREATE TABLE Client (id TEXT PRIMARY KEY, clinicId TEXT NOT NULL, medicalHistory TEXT DEFAULT '[]')");
$db->exec("INSERT INTO Clinic (id) VALUES ('clinic-a')");
$db->exec("INSERT INTO Client (id, clinicId, medicalHistory) VALUES ('patient-a', 'clinic-a', '[\"existing-history\"]')");

echo "== operations-only safety boundary ==\n";
$policy = pf_clinical_safety_policy($db, 'clinic-a');
safety_check('defaults to operations-only mode', $policy['operatingMode'] === 'operations_only');
safety_check('clinical record capability fails closed', $policy['clinicalRecordEnabled'] === false);
safety_check('treatment writes fail closed', $policy['treatmentProcedureEntryEnabled'] === false);
safety_check('medical-history writes fail closed', $policy['medicalHistoryEntryEnabled'] === false);
safety_check('patient image publication fails closed', $policy['patientImagePublicationEnabled'] === false);
safety_check('AI clinical advice fails closed', $policy['aiClinicalAdviceEnabled'] === false);

$migrationDb = new PDO('sqlite::memory:');
$migrationDb->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$migrationDb->exec("CREATE TABLE ClinicFeatureSetting (clinicId TEXT PRIMARY KEY, marketingEnabled INTEGER DEFAULT 0)");
$migrationDb->exec(file_get_contents(__DIR__ . '/../migrations/2026-07-10-operations-only-safety.sqlite.sql'));
$migrationColumns = array_column($migrationDb->query('PRAGMA table_info(ClinicFeatureSetting)')->fetchAll(PDO::FETCH_ASSOC), 'name');
safety_check('SQLite migration adds every safety-policy column', !array_diff([
    'operatingMode', 'clinicalRecordEnabled', 'treatmentProcedureEntryEnabled', 'medicalHistoryEntryEnabled',
    'patientImagePublicationEnabled', 'aiClinicalAdviceEnabled', 'clinicalPolicyVersion',
], $migrationColumns));

tenant_features_save($db, 'clinic-a', [
    'operatingMode' => 'clinical',
    'clinicalRecordEnabled' => true,
    'treatmentProcedureEntryEnabled' => true,
    'patientImagePublicationEnabled' => true,
]);
$afterAttempt = pf_clinical_safety_policy($db, 'clinic-a');
safety_check('feature update cannot bypass phase-A lock', $afterAttempt['operatingMode'] === 'operations_only' && !$afterAttempt['treatmentProcedureEntryEnabled'] && !$afterAttempt['patientImagePublicationEnabled']);
$rawFeatureView = tenant_features_get($db, 'clinic-a');
safety_check('all feature consumers receive fail-closed values', $rawFeatureView['operatingMode'] === 'operations_only' && !$rawFeatureView['clinicalRecordEnabled'] && !$rawFeatureView['aiClinicalAdviceEnabled']);

$history = $db->query("SELECT medicalHistory FROM Client WHERE id = 'patient-a'")->fetchColumn();
safety_check('existing clinical-like data is preserved unchanged', $history === '["existing-history"]');
safety_check('empty medical history input is not treated as a write', !pf_input_has_meaningful_value('[]'));
safety_check('non-empty medical history input is detected', pf_input_has_meaningful_value(['allergy' => 'latex']));

safety_check('medical prompt is detected before provider use', pf_ai_message_requests_clinical_guidance('I have severe tooth pain, what medicine should I take?'));
safety_check('administrative booking prompt remains allowed', !pf_ai_message_requests_clinical_guidance('Can I book an appointment for Tuesday at 3pm?'));
$refusal = pf_ai_operations_only_refusal('I have chest pain');
safety_check('urgent refusal includes emergency direction', stripos($refusal, 'emergency services') !== false);
safety_check('unsafe generated reply is replaced', pf_ai_filter_operations_reply('What are your hours?', 'You should take 500 mg antibiotic') === pf_ai_operations_only_refusal('What are your hours?'));
safety_check('safe administrative reply passes through', pf_ai_filter_operations_reply('What are your hours?', 'We are open from 9am to 5pm.') === 'We are open from 9am to 5pm.');

$treatmentSource = file_get_contents(__DIR__ . '/../controllers/TreatmentController.php');
$gallerySource = file_get_contents(__DIR__ . '/../controllers/GalleryController.php');
$publicSiteSource = file_get_contents(__DIR__ . '/../controllers/PublicSiteController.php');
$aiSource = file_get_contents(__DIR__ . '/../services/aiReceptionistService.php');
safety_check('all treatment write methods use the backend guard', substr_count($treatmentSource, 'enforceClinicalWrite($db') >= 6);
safety_check('public image upload uses the backend guard', strpos($gallerySource, "'patientImagePublicationEnabled'") !== false);
safety_check('public website suppresses patient gallery by policy', strpos($publicSiteSource, "pf_clinical_capability_enabled") !== false);
safety_check('AI preview checks medical intent before loading the provider', strpos($aiSource, 'pf_ai_message_requests_clinical_guidance($message)') < strpos($aiSource, "require_once __DIR__ . '/aiService.php'"));

echo "\n$pass passed, $fail failed\n";
if ($fail) {
    echo 'FAILED: ' . implode(' | ', $failures) . "\n";
    exit(1);
}
