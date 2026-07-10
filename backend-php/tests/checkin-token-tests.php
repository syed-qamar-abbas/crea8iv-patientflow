<?php
// Focused P0-1 security tests for opaque, locally-rendered check-in QR tokens.

error_reporting(E_ALL);
putenv('APP_ENV=development');
putenv('DB_DRIVER=sqlite');
putenv('DB_PATH=:memory:');
putenv('JWT_SECRET=test-secret-please-ignore-0123456789abcdef');
putenv('JWT_REFRESH_SECRET=test-refresh-secret-0123456789abcdef00');

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../services/checkinTokenService.php';
require_once __DIR__ . '/../services/qrService.php';

$pass = 0;
$fail = 0;
$failures = [];

function qr_check($name, $condition) {
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

function qr_expect_code($name, $expectedCode, $callable) {
    try {
        $callable();
        qr_check($name, false);
    } catch (CheckinTokenException $e) {
        qr_check($name, $e->reasonCode === $expectedCode);
    }
}

$db = DB::getConnection();
$db->exec("CREATE TABLE Clinic (id TEXT PRIMARY KEY)");
$db->exec("CREATE TABLE User (id TEXT PRIMARY KEY, clinicId TEXT NOT NULL, FOREIGN KEY (clinicId) REFERENCES Clinic(id))");
$db->exec("CREATE TABLE Client (id TEXT PRIMARY KEY, clinicId TEXT NOT NULL, loyaltyPoints INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (clinicId) REFERENCES Clinic(id))");
$db->exec("CREATE TABLE Appointment (
    id TEXT PRIMARY KEY,
    clinicId TEXT NOT NULL,
    clientId TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    checkedIn INTEGER NOT NULL DEFAULT 0,
    checkinTime TEXT DEFAULT NULL,
    FOREIGN KEY (clinicId) REFERENCES Clinic(id),
    FOREIGN KEY (clientId) REFERENCES Client(id)
)");
$db->exec(file_get_contents(__DIR__ . '/../migrations/2026-07-10-secure-checkin-tokens.sqlite.sql'));

$db->exec("INSERT INTO Clinic (id) VALUES ('clinic-a'), ('clinic-b')");
$db->exec("INSERT INTO User (id, clinicId) VALUES ('user-a', 'clinic-a'), ('user-b', 'clinic-b')");
$db->exec("INSERT INTO Client (id, clinicId) VALUES ('patient-a', 'clinic-a')");
foreach (['appt-main', 'appt-expired', 'appt-revoked', 'appt-reused', 'appt-cancelled', 'appt-completed', 'appt-cross', 'appt-manual'] as $id) {
    $stmt = $db->prepare("INSERT INTO Appointment (id, clinicId, clientId, price) VALUES (?, 'clinic-a', 'patient-a', 1000)");
    $stmt->execute([$id]);
}

echo "== secure check-in token ==\n";
$issued = pf_issue_checkin_token($db, 'clinic-a', 'appt-main', 'user-a');
qr_check('payload uses the versioned opaque prefix', strpos($issued['payload'], PF_CHECKIN_TOKEN_PREFIX) === 0);
qr_check('raw token contains 256 bits of entropy', strlen(base64url_decode($issued['rawToken'])) === PF_CHECKIN_TOKEN_BYTES);

$forbiddenValues = ['patient-a', 'appt-main', 'clinic-a', '2026-07-10', '10:00', 'Patient Name'];
qr_check('payload contains no patient or appointment metadata', !array_filter($forbiddenValues, fn($value) => strpos($issued['payload'], $value) !== false));

$storedRow = $db->query("SELECT * FROM AppointmentCheckinToken WHERE appointmentId = 'appt-main'")->fetch();
$stored = $storedRow['tokenHash'];
qr_check('database stores SHA-256 hash only', $stored === pf_checkin_token_hash($issued['rawToken']) && strlen($stored) === 64);
qr_check('database never stores the raw token', strpos(json_encode($storedRow), $issued['rawToken']) === false);

$qrImage = pf_render_checkin_qr_data_uri($issued['payload']);
qr_check('QR is rendered locally as an image data URI', strpos($qrImage, 'data:image/') === 0);
$qrMarkup = base64_decode(substr($qrImage, strpos($qrImage, ',') + 1));
qr_check('raw token is not embedded as visible SVG metadata', strpos($qrMarkup, $issued['rawToken']) === false);
qr_expect_code('malformed token is rejected', 'malformed_token', fn() => pf_consume_checkin_token($db, 'clinic-a', 'not-a-checkin-token', 'user-a'));

$expired = pf_issue_checkin_token($db, 'clinic-a', 'appt-expired', 'user-a');
$db->exec("UPDATE AppointmentCheckinToken SET expiresAt = '2000-01-01 00:00:00' WHERE appointmentId = 'appt-expired'");
qr_expect_code('expired token is rejected', 'token_expired', fn() => pf_consume_checkin_token($db, 'clinic-a', $expired['payload'], 'user-a'));

$revoked = pf_issue_checkin_token($db, 'clinic-a', 'appt-revoked', 'user-a');
pf_revoke_checkin_tokens($db, 'clinic-a', 'appt-revoked', 'revoked_by_user');
qr_expect_code('revoked token is rejected', 'token_revoked', fn() => pf_consume_checkin_token($db, 'clinic-a', $revoked['payload'], 'user-a'));

$reused = pf_issue_checkin_token($db, 'clinic-a', 'appt-reused', 'user-a');
$consumed = pf_consume_checkin_token($db, 'clinic-a', $reused['payload'], 'user-a');
qr_check('valid token checks in its appointment', $consumed['appointmentId'] === 'appt-reused');
qr_expect_code('used token cannot be replayed', 'token_used', fn() => pf_consume_checkin_token($db, 'clinic-a', $reused['payload'], 'user-a'));

$cancelled = pf_issue_checkin_token($db, 'clinic-a', 'appt-cancelled', 'user-a');
$db->exec("UPDATE Appointment SET status = 'cancelled' WHERE id = 'appt-cancelled'");
qr_expect_code('cancelled appointment is rejected', 'appointment_unavailable', fn() => pf_consume_checkin_token($db, 'clinic-a', $cancelled['payload'], 'user-a'));

$completed = pf_issue_checkin_token($db, 'clinic-a', 'appt-completed', 'user-a');
$db->exec("UPDATE Appointment SET status = 'completed' WHERE id = 'appt-completed'");
qr_expect_code('completed appointment is rejected', 'appointment_unavailable', fn() => pf_consume_checkin_token($db, 'clinic-a', $completed['payload'], 'user-a'));

$crossTenant = pf_issue_checkin_token($db, 'clinic-a', 'appt-cross', 'user-a');
qr_expect_code('cross-tenant token is rejected', 'token_not_found', fn() => pf_consume_checkin_token($db, 'clinic-b', $crossTenant['payload'], 'user-b'));

$manual = pf_manual_checkin_appointment($db, 'clinic-a', 'appt-manual');
$manualRow = $db->query("SELECT checkedIn, status FROM Appointment WHERE id = 'appt-manual'")->fetch();
qr_check('manual check-in fallback still works', $manual['id'] === 'appt-manual' && intval($manualRow['checkedIn']) === 1 && $manualRow['status'] === 'confirmed');

$forbiddenHost = 'api.' . 'qrserver' . '.com';
$sourceFiles = [
    __DIR__ . '/../helpers.php',
    __DIR__ . '/../controllers/AppointmentController.php',
    __DIR__ . '/../services/aiReceptionistService.php',
    __DIR__ . '/../services/qrService.php',
];
$hasExternalQrDependency = false;
foreach ($sourceFiles as $sourceFile) {
    if (strpos(file_get_contents($sourceFile), $forbiddenHost) !== false) $hasExternalQrDependency = true;
}
qr_check('production QR code paths contain no public QR service dependency', !$hasExternalQrDependency);

echo "\n$pass passed, $fail failed\n";
if ($fail) {
    echo 'FAILED: ' . implode(' | ', $failures) . "\n";
    exit(1);
}
