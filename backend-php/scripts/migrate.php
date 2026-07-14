<?php
// CLI-only migration runner. Do not expose this through HTTP routes.
//
// Usage:
//   php backend-php/scripts/migrate.php status
//   php backend-php/scripts/migrate.php dry-run
//   php backend-php/scripts/migrate.php migrate
//   php backend-php/scripts/migrate.php baseline

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../services/migrationService.php';

$command = $argv[1] ?? 'status';
$dir = __DIR__ . '/../migrations';
$db = DB::getConnection();
$owner = gethostname() ?: 'patientflow-cli';

function pf_migration_cli_print_status($rows) {
    foreach ($rows as $row) {
        echo str_pad($row['status'], 18) . $row['name'];
        if (!empty($row['appliedAt'])) echo '  ' . $row['appliedAt'];
        echo PHP_EOL;
    }
}

try {
    if ($command === 'status') {
        pf_migration_cli_print_status(pf_migration_status($db, $dir));
        exit(0);
    }

    if ($command === 'dry-run') {
        $result = pf_migration_migrate($db, $dir, ['dryRun' => true, 'owner' => $owner]);
        foreach ($result['pending'] as $name) {
            echo "pending  $name" . PHP_EOL;
        }
        echo count($result['pending']) . " pending migration(s)" . PHP_EOL;
        exit(0);
    }

    if ($command === 'migrate') {
        $result = pf_migration_migrate($db, $dir, ['owner' => $owner]);
        foreach ($result['applied'] as $row) {
            echo "applied  {$row['name']} ({$row['executionMs']}ms)" . PHP_EOL;
        }
        echo count($result['applied']) . " migration(s) applied" . PHP_EOL;
        exit(0);
    }

    if ($command === 'baseline') {
        $inserted = pf_migration_baseline($db, $dir, ['owner' => $owner]);
        foreach ($inserted as $name) {
            echo "baselined  $name" . PHP_EOL;
        }
        echo count($inserted) . " migration(s) baselined" . PHP_EOL;
        exit(0);
    }

    fwrite(STDERR, "Unknown command: $command" . PHP_EOL);
    exit(2);
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage() . PHP_EOL);
    exit(1);
}
