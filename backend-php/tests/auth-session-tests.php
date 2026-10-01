<?php
// Focused auth regression: a stale refresh token from another tab must not
// revoke the user's other valid sessions.

error_reporting(E_ALL);

putenv('APP_ENV=development');
putenv('DB_DRIVER=sqlite');
putenv('JWT_SECRET=test-secret-please-ignore-0123456789abcdef');
putenv('JWT_REFRESH_SECRET=test-refresh-secret-0123456789abcdef00');

if (($argv[1] ?? '') === 'refresh-child') {
    putenv('DB_PATH=' . $argv[2]);
    require_once __DIR__ . '/../controllers/AuthController.php';
    $token = base64_decode($argv[3], true);
    (new AuthController())->refresh(['refreshToken' => $token], null);
    exit(2);
}

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../controllers/AuthController.php';

$passed = 0;
$failed = 0;
function auth_check($name, $condition) {
    global $passed, $failed;
    if ($condition) { $passed++; echo "  ok  $name\n"; }
    else { $failed++; echo "FAIL  $name\n"; }
}

$authController = new AuthController();
$resetBaseMethod = new ReflectionMethod(AuthController::class, 'passwordResetBaseUrl');
auth_check(
    'password reset keeps the PatientFlow production origin',
    $resetBaseMethod->invoke($authController, [
        'resetBaseUrl' => 'https://patientflow.crea8ivmedia.com/reset-password',
    ]) === 'https://patientflow.crea8ivmedia.com/reset-password'
);
auth_check(
    'password reset rejects an untrusted redirect origin',
    $resetBaseMethod->invoke($authController, [
        'resetBaseUrl' => 'https://attacker.example/reset-password',
    ]) === rtrim(CLIENT_URL, '/') . '/reset-password'
);

$dbPath = tempnam(sys_get_temp_dir(), 'patientflow-auth-');
$db = new PDO('sqlite:' . $dbPath);
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec('CREATE TABLE RefreshToken (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    userId TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)');
$db->prepare('INSERT INTO RefreshToken (id, token, userId, expiresAt) VALUES (?, ?, ?, ?)')
   ->execute(['keeper', 'still-valid-on-another-device', 'user-1', date('Y-m-d H:i:s', time() + 3600)]);

$staleToken = jwt_sign_refresh(['id' => 'user-1', 'jti' => 'already-rotated']);
$command = escapeshellarg(PHP_BINARY)
    . ' ' . escapeshellarg(__FILE__)
    . ' refresh-child ' . escapeshellarg($dbPath)
    . ' ' . escapeshellarg(base64_encode($staleToken));
exec($command, $childOutput, $childStatus);

$remaining = (int)$db->query('SELECT COUNT(*) FROM RefreshToken WHERE id = \'keeper\'')->fetchColumn();
auth_check('stale refresh request is rejected', $childStatus === 0 && strpos(implode("\n", $childOutput), 'expired or invalid') !== false);
auth_check('stale refresh does not revoke another valid session', $remaining === 1);

$db = null;
@unlink($dbPath);

echo "$passed passed, $failed failed\n";
exit($failed ? 1 : 0);
