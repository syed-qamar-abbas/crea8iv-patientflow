<?php
// Focused contract tests for the versioned multi-niche template engine.

error_reporting(E_ALL);
putenv('APP_ENV=development');
putenv('DB_DRIVER=sqlite');
putenv('DB_PATH=:memory:');
putenv('JWT_SECRET=test-secret-please-ignore-0123456789abcdef');
putenv('JWT_REFRESH_SECRET=test-refresh-secret-0123456789abcdef00');

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../services/industryTemplateService.php';

$pass = 0;
$fail = 0;
$failures = [];

function template_check($name, $condition) {
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

echo "== industry template v2 contract ==\n";
$builtins = industry_template_builtins();
$canonical = ['dental_clinic', 'aesthetic_clinic', 'dental_aesthetic_clinic', 'interiors_architects', 'real_estate', 'marketing_agency'];

template_check('all six canonical niche templates exist', !array_diff($canonical, array_keys($builtins)));
template_check('legacy healthcare fallback remains available', isset($builtins[INDUSTRY_TEMPLATE_DEFAULT]));

foreach ($canonical as $key) {
    $config = $builtins[$key]['config'];
    template_check("$key uses schema v2", ($config['schemaVersion'] ?? null) === INDUSTRY_TEMPLATE_SCHEMA_VERSION);
    template_check("$key defines a conversion goal", !empty($config['primaryGoal']['key']) && !empty($config['primaryGoal']['eventType']));
    template_check("$key defines scheduling event types", !empty($config['scheduling']['eventTypes']));
    template_check("$key defines profile fields", !empty($config['profile']['fields']));
    template_check("$key keeps clinical writes fail-closed", empty($config['capabilities']['clinicalRecordEntry']) && empty($config['capabilities']['procedureEntry']) && empty($config['capabilities']['medicalHistoryEntry']));
}

template_check('dental template enables dental context', !empty($builtins['dental_clinic']['config']['capabilities']['dentalContext']));
template_check('combined clinic enables both specialty contexts', !empty($builtins['dental_aesthetic_clinic']['config']['capabilities']['dentalContext']) && !empty($builtins['dental_aesthetic_clinic']['config']['capabilities']['aestheticContext']));
template_check('interiors converts appointments to consultations', $builtins['interiors_architects']['config']['terms']['appointment'] === 'Consultation');
template_check('real estate primary goal is meeting scheduling', $builtins['real_estate']['config']['primaryGoal']['eventType'] === 'meeting');
template_check('marketing agency has a discovery conversion goal', $builtins['marketing_agency']['config']['primaryGoal']['eventType'] === 'discovery_meeting');
template_check('non-clinic templates hide lab', !$builtins['interiors_architects']['config']['modules']['lab']['visible'] && !$builtins['real_estate']['config']['modules']['lab']['visible'] && !$builtins['marketing_agency']['config']['modules']['lab']['visible']);

$db = new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
industry_templates_ensure($db);
$stored = industry_templates_list($db);
template_check('canonical templates seed into storage', !array_diff($canonical, array_column($stored, 'templateKey')));
$realEstate = industry_template_get($db, 'real_estate');
template_check('stored config round-trips structured fields', $realEstate['config']['workflow']['key'] === 'real_estate_pipeline' && count($realEstate['config']['profile']['fields']) >= 8);
$fallback = industry_template_get($db, 'not-a-real-template');
template_check('unknown selection falls back without data mutation', $fallback['templateKey'] === INDUSTRY_TEMPLATE_DEFAULT);

$interfaceDb = new PDO('sqlite::memory:');
$interfaceDb->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$interfaceDb->exec("CREATE TABLE Client (id TEXT PRIMARY KEY, clinicId TEXT NOT NULL)");
$interfaceDb->exec("CREATE TABLE Appointment (id TEXT PRIMARY KEY, clinicId TEXT NOT NULL, date TEXT NOT NULL)");
$interfaceDb->exec(file_get_contents(__DIR__ . '/../migrations/2026-07-11-template-interface-v2.sqlite.sql'));
$clientColumns = array_column($interfaceDb->query('PRAGMA table_info(Client)')->fetchAll(PDO::FETCH_ASSOC), 'name');
$appointmentColumns = array_column($interfaceDb->query('PRAGMA table_info(Appointment)')->fetchAll(PDO::FETCH_ASSOC), 'name');
template_check('interface migration adds profile and workflow storage', !array_diff(['profileData', 'workflowStage'], $clientColumns));
template_check('interface migration adds schedule event type', in_array('eventType', $appointmentColumns, true));

$clientController = file_get_contents(__DIR__ . '/../controllers/ClientController.php');
$appointmentController = file_get_contents(__DIR__ . '/../controllers/AppointmentController.php');
template_check('client API persists template extension fields', strpos($clientController, 'profileData') !== false && strpos($clientController, 'workflowStage') !== false);
template_check('appointment API persists event type', strpos($appointmentController, 'eventType') !== false);

echo "\n$pass passed, $fail failed\n";
if ($fail) {
    echo 'FAILED: ' . implode(' | ', $failures) . "\n";
    exit(1);
}
exit(0);
