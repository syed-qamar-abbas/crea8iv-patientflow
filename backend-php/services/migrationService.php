<?php

class MigrationException extends RuntimeException {}
class MigrationLockException extends MigrationException {}
class MigrationChecksumException extends MigrationException {}

function pf_migration_driver() {
    return defined('DB_DRIVER') ? DB_DRIVER : 'mysql';
}

function pf_migration_now() {
    return date('Y-m-d H:i:s');
}

function pf_migration_ensure_tables($db) {
    if (pf_migration_driver() === 'sqlite') {
        $db->exec("CREATE TABLE IF NOT EXISTS SchemaMigration (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            migrationName TEXT NOT NULL UNIQUE,
            checksum TEXT NOT NULL,
            driver TEXT NOT NULL,
            appliedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            executionMs INTEGER NOT NULL DEFAULT 0,
            appliedBy TEXT DEFAULT NULL
        )");
        $db->exec("CREATE TABLE IF NOT EXISTS SchemaMigrationLock (
            lockName TEXT NOT NULL PRIMARY KEY,
            acquiredAt TEXT NOT NULL,
            acquiredBy TEXT NOT NULL
        )");
        return;
    }

    $db->exec("CREATE TABLE IF NOT EXISTS `SchemaMigration` (
        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        `migrationName` VARCHAR(190) NOT NULL,
        `checksum` CHAR(64) NOT NULL,
        `driver` VARCHAR(20) NOT NULL,
        `appliedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `executionMs` INT UNSIGNED NOT NULL DEFAULT 0,
        `appliedBy` VARCHAR(190) DEFAULT NULL,
        PRIMARY KEY (`id`),
        UNIQUE KEY `UX_SchemaMigration_Name` (`migrationName`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $db->exec("CREATE TABLE IF NOT EXISTS `SchemaMigrationLock` (
        `lockName` VARCHAR(64) NOT NULL,
        `acquiredAt` DATETIME NOT NULL,
        `acquiredBy` VARCHAR(190) NOT NULL,
        PRIMARY KEY (`lockName`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function pf_migration_files($dir, $driver = null) {
    $driver = $driver ?: pf_migration_driver();
    $files = glob(rtrim($dir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . '*.sql') ?: [];
    $filtered = array_values(array_filter($files, function ($file) use ($driver) {
        $isSqlite = substr($file, -11) === '.sqlite.sql';
        return $driver === 'sqlite' ? $isSqlite : !$isSqlite;
    }));
    sort($filtered, SORT_STRING);
    return array_map(function ($file) {
        return [
            'name' => basename($file),
            'path' => $file,
            'checksum' => hash_file('sha256', $file),
        ];
    }, $filtered);
}

function pf_migration_applied($db) {
    pf_migration_ensure_tables($db);
    $rows = $db->query("SELECT migrationName, checksum, driver, appliedAt, executionMs, appliedBy FROM SchemaMigration ORDER BY migrationName")->fetchAll();
    $map = [];
    foreach ($rows as $row) {
        $map[$row['migrationName']] = $row;
    }
    return $map;
}

function pf_migration_status($db, $dir) {
    $applied = pf_migration_applied($db);
    $status = [];
    foreach (pf_migration_files($dir) as $file) {
        $row = $applied[$file['name']] ?? null;
        $state = 'pending';
        if ($row) {
            $state = hash_equals($row['checksum'], $file['checksum']) ? 'applied' : 'checksum_mismatch';
        }
        $status[] = array_merge($file, [
            'status' => $state,
            'appliedAt' => $row['appliedAt'] ?? null,
            'executionMs' => isset($row['executionMs']) ? (int)$row['executionMs'] : null,
        ]);
    }
    return $status;
}

function pf_migration_acquire_lock($db, $owner) {
    pf_migration_ensure_tables($db);
    try {
        $stmt = $db->prepare("INSERT INTO SchemaMigrationLock (lockName, acquiredAt, acquiredBy) VALUES ('migrations', ?, ?)");
        $stmt->execute([pf_migration_now(), $owner]);
    } catch (Throwable $e) {
        $row = $db->query("SELECT acquiredAt, acquiredBy FROM SchemaMigrationLock WHERE lockName = 'migrations'")->fetch();
        $heldBy = $row ? ($row['acquiredBy'] . ' at ' . $row['acquiredAt']) : 'another process';
        throw new MigrationLockException("Migration lock is already held by $heldBy");
    }
}

function pf_migration_release_lock($db) {
    pf_migration_ensure_tables($db);
    $db->exec("DELETE FROM SchemaMigrationLock WHERE lockName = 'migrations'");
}

function pf_migration_split_sql($sql) {
    $statements = [];
    $buffer = '';
    $quote = null;
    $len = strlen($sql);

    for ($i = 0; $i < $len; $i++) {
        $ch = $sql[$i];
        $next = $i + 1 < $len ? $sql[$i + 1] : '';

        if ($quote === null && $ch === '-' && $next === '-') {
            while ($i < $len && $sql[$i] !== "\n") {
                $buffer .= $sql[$i++];
            }
            if ($i < $len) $buffer .= $sql[$i];
            continue;
        }
        if ($quote === null && $ch === '#') {
            while ($i < $len && $sql[$i] !== "\n") {
                $buffer .= $sql[$i++];
            }
            if ($i < $len) $buffer .= $sql[$i];
            continue;
        }
        if ($quote === null && $ch === '/' && $next === '*') {
            $buffer .= $ch . $next;
            $i += 2;
            while ($i < $len) {
                $buffer .= $sql[$i];
                if ($sql[$i] === '*' && $i + 1 < $len && $sql[$i + 1] === '/') {
                    $buffer .= '/';
                    $i++;
                    break;
                }
                $i++;
            }
            continue;
        }

        if ($quote !== null) {
            $buffer .= $ch;
            if ($ch === '\\' && $quote !== '`' && $i + 1 < $len) {
                $buffer .= $sql[++$i];
                continue;
            }
            if ($ch === $quote) {
                if ($quote !== '`' && $i + 1 < $len && $sql[$i + 1] === $quote) {
                    $buffer .= $sql[++$i];
                    continue;
                }
                $quote = null;
            }
            continue;
        }

        if ($ch === "'" || $ch === '"' || $ch === '`') {
            $quote = $ch;
            $buffer .= $ch;
            continue;
        }

        if ($ch === ';') {
            $statement = trim($buffer);
            if ($statement !== '') $statements[] = $statement;
            $buffer = '';
            continue;
        }

        $buffer .= $ch;
    }

    $statement = trim($buffer);
    if ($statement !== '') $statements[] = $statement;
    return $statements;
}

function pf_migration_record($db, $file, $executionMs, $owner) {
    $stmt = $db->prepare("INSERT INTO SchemaMigration (migrationName, checksum, driver, appliedAt, executionMs, appliedBy)
        VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$file['name'], $file['checksum'], pf_migration_driver(), pf_migration_now(), $executionMs, $owner]);
}

function pf_migration_run_file($db, $file, $owner) {
    $start = microtime(true);
    $sql = file_get_contents($file['path']);
    if ($sql === false) {
        throw new MigrationException("Unable to read migration {$file['name']}");
    }
    foreach (pf_migration_split_sql($sql) as $statement) {
        $db->exec($statement);
    }
    $executionMs = (int)round((microtime(true) - $start) * 1000);
    pf_migration_record($db, $file, $executionMs, $owner);
    return $executionMs;
}

function pf_migration_migrate($db, $dir, $options = []) {
    $owner = $options['owner'] ?? (gethostname() ?: 'cli');
    $dryRun = !empty($options['dryRun']);
    $applied = pf_migration_applied($db);
    $files = pf_migration_files($dir);
    $pending = [];

    foreach ($files as $file) {
        if (!isset($applied[$file['name']])) {
            $pending[] = $file;
            continue;
        }
        if (!hash_equals($applied[$file['name']]['checksum'], $file['checksum'])) {
            throw new MigrationChecksumException("Checksum mismatch for {$file['name']}; do not edit applied migrations");
        }
    }

    if ($dryRun) return ['applied' => [], 'pending' => array_column($pending, 'name')];

    pf_migration_acquire_lock($db, $owner);
    $appliedNow = [];
    try {
        foreach ($pending as $file) {
            $executionMs = pf_migration_run_file($db, $file, $owner);
            $appliedNow[] = ['name' => $file['name'], 'executionMs' => $executionMs];
        }
    } finally {
        pf_migration_release_lock($db);
    }

    return ['applied' => $appliedNow, 'pending' => []];
}

function pf_migration_baseline($db, $dir, $options = []) {
    $owner = $options['owner'] ?? (gethostname() ?: 'cli');
    $applied = pf_migration_applied($db);
    $inserted = [];
    pf_migration_acquire_lock($db, $owner);
    try {
        foreach (pf_migration_files($dir) as $file) {
            if (isset($applied[$file['name']])) continue;
            pf_migration_record($db, $file, 0, $owner . ':baseline');
            $inserted[] = $file['name'];
        }
    } finally {
        pf_migration_release_lock($db);
    }
    return $inserted;
}
