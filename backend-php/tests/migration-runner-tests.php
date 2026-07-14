<?php
// Focused tests for the CLI migration ledger and checksum enforcement.

error_reporting(E_ALL);
putenv('APP_ENV=development');
putenv('DB_DRIVER=sqlite');
putenv('DB_PATH=:memory:');
putenv('JWT_SECRET=test-secret-please-ignore-0123456789abcdef');
putenv('JWT_REFRESH_SECRET=test-refresh-secret-0123456789abcdef00');

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../services/migrationService.php';

$pass = 0;
$fail = 0;
$failures = [];

function migration_check($name, $condition) {
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

function migration_expect($name, $class, $fn) {
    try {
        $fn();
        migration_check($name, false);
    } catch (Throwable $e) {
        migration_check($name, $e instanceof $class);
    }
}

function migration_temp_dir() {
    $dir = sys_get_temp_dir() . '/pf-migrations-' . bin2hex(random_bytes(6));
    mkdir($dir, 0700, true);
    return $dir;
}

function migration_write($dir, $name, $sql) {
    file_put_contents($dir . '/' . $name, $sql);
}

echo "== migration runner ==\n";
$db = DB::getConnection();
$dir = migration_temp_dir();
migration_write($dir, '2026-01-01-alpha.sqlite.sql', "CREATE TABLE Alpha (id TEXT PRIMARY KEY);\nINSERT INTO Alpha (id) VALUES ('a');\n");
migration_write($dir, '2026-01-02-beta.sqlite.sql', "CREATE TABLE Beta (id TEXT PRIMARY KEY, note TEXT);\nINSERT INTO Beta (id, note) VALUES ('b', 'semi;colon');\n");
migration_write($dir, '2026-01-03-ignore-mysql.sql', "CREATE TABLE ShouldNotRun (id TEXT PRIMARY KEY);\n");

$status = pf_migration_status($db, $dir);
migration_check('status lists only sqlite migrations for sqlite driver', count($status) === 2 && $status[0]['status'] === 'pending');

$dry = pf_migration_migrate($db, $dir, ['dryRun' => true, 'owner' => 'test']);
migration_check('dry-run does not apply migrations', count($dry['pending']) === 2 && !$db->query("SELECT name FROM sqlite_master WHERE type='table' AND name='Alpha'")->fetch());

$result = pf_migration_migrate($db, $dir, ['owner' => 'test']);
migration_check('migrate applies pending files in order', array_column($result['applied'], 'name') === ['2026-01-01-alpha.sqlite.sql', '2026-01-02-beta.sqlite.sql']);
migration_check('migration SQL executed', $db->query("SELECT note FROM Beta WHERE id = 'b'")->fetchColumn() === 'semi;colon');
migration_check('ledger records applied migrations', (int)$db->query("SELECT COUNT(*) FROM SchemaMigration")->fetchColumn() === 2);
migration_check('rerun is idempotent', count(pf_migration_migrate($db, $dir, ['owner' => 'test'])['applied']) === 0);

$addColumns = pf_migration_parse_mysql_add_columns("ALTER TABLE WhatsAppSetting ADD COLUMN quietHoursStart VARCHAR(10) DEFAULT '21:00', ADD COLUMN lastWebhookError TEXT");
migration_check('mysql add-column parser reads table name', $addColumns['table'] === 'WhatsAppSetting');
migration_check('mysql add-column parser reads all column names', array_column($addColumns['columns'], 'name') === ['quietHoursStart', 'lastWebhookError']);
migration_check('mysql add-column parser rejects non-add-column alter', pf_migration_parse_mysql_add_columns('ALTER TABLE Clinic DROP COLUMN oldField') === null);
$commentedAddColumns = pf_migration_parse_mysql_add_columns("-- migration note\nALTER TABLE `Clinic` ADD COLUMN `slug` VARCHAR(63) DEFAULT NULL, ADD UNIQUE KEY `UX_Clinic_Slug` (`slug`)");
migration_check('mysql add-column parser ignores leading comments', $commentedAddColumns['table'] === 'Clinic' && $commentedAddColumns['columns'][0]['name'] === 'slug');
migration_check('mysql add-column parser keeps follow-up key clauses', $commentedAddColumns['otherClauses'] === ['ADD UNIQUE KEY `UX_Clinic_Slug` (`slug`)']);
$addKey = pf_migration_parse_mysql_add_key('ALTER TABLE `Clinic` ADD UNIQUE KEY `UX_Clinic_CustomDomain` (`customDomain`)');
migration_check('mysql add-key parser reads key name', $addKey['table'] === 'Clinic' && $addKey['key'] === 'UX_Clinic_CustomDomain');

migration_write($dir, '2026-01-02-beta.sqlite.sql', "CREATE TABLE Beta (id TEXT PRIMARY KEY, note TEXT);\n");
migration_expect('edited applied migration is rejected by checksum', MigrationChecksumException::class, fn() => pf_migration_migrate($db, $dir, ['owner' => 'test']));

$lockedDb = new PDO('sqlite::memory:');
$lockedDb->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
pf_migration_ensure_tables($lockedDb);
pf_migration_acquire_lock($lockedDb, 'holder');
migration_expect('existing lock rejects concurrent migrate', MigrationLockException::class, fn() => pf_migration_acquire_lock($lockedDb, 'second'));
pf_migration_release_lock($lockedDb);
migration_check('lock can be released', !$lockedDb->query("SELECT * FROM SchemaMigrationLock")->fetch());

$baselineDb = new PDO('sqlite::memory:');
$baselineDb->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$baseline = pf_migration_baseline($baselineDb, $dir, ['owner' => 'baseline-test']);
migration_check('baseline records migrations without executing SQL', count($baseline) === 2 && !$baselineDb->query("SELECT name FROM sqlite_master WHERE type='table' AND name='Alpha'")->fetch());

echo "\n$pass passed, $fail failed\n";
if ($fail) {
    echo 'FAILED: ' . implode(' | ', $failures) . "\n";
    exit(1);
}
