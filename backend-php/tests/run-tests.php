<?php
// Dependency-free test runner for the PatientFlow API.
//
//   php backend-php/tests/run-tests.php
//
// Covers the money math, JWT auth primitives, signed file URLs, and package
// gating — the logic where a silent regression costs real money or leaks data.
// Exits non-zero on any failure (CI gate).

error_reporting(E_ALL);

// --- Bootstrap: config needs env; keep it hermetic (sqlite, throwaway secrets)
putenv('APP_ENV=development');
putenv('DB_DRIVER=sqlite');
putenv('DB_PATH=:memory:');
putenv('JWT_SECRET=test-secret-please-ignore-0123456789abcdef');
putenv('JWT_REFRESH_SECRET=test-refresh-secret-0123456789abcdef00');

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../services/invoiceMath.php';
require_once __DIR__ . '/../services/packageService.php';
require_once __DIR__ . '/../services/usernameService.php';

$pass = 0; $fail = 0; $failures = [];
function check($name, $cond) {
    global $pass, $fail, $failures;
    if ($cond) { $pass++; echo "  ok  $name\n"; }
    else { $fail++; $failures[] = $name; echo "FAIL  $name\n"; }
}
function throws($name, $fn, $class = 'InvalidArgumentException') {
    try { $fn(); check($name, false); }
    catch (Throwable $e) { check($name, $e instanceof $class); }
}
function approx($a, $b, $eps = 0.0001) { return abs($a - $b) < $eps; }

// ---------------------------------------------------------------------------
echo "== invoiceMath ==\n";
$items = [['description' => 'Consultation', 'qty' => 1, 'unitPrice' => 2500]];

$t = pf_invoice_totals($items);
check('subtotal = qty*price', approx($t['subtotal'], 2500));
check('no discount/tax => total = subtotal', approx($t['total'], 2500));
check('unpaid => status pending', $t['status'] === 'pending');
check('unpaid => balanceDue = grandTotal', approx($t['balanceDue'], 2500));

$t = pf_invoice_totals($items, 20);
check('20% discount on 2500 stores amount 500', approx($t['discount'], 500));
check('discounted total 2000', approx($t['total'], 2000));

$t = pf_invoice_totals($items, 0, 10);
check('10% tax on 2500 = 250', approx($t['tax'], 250));

$t = pf_invoice_totals($items, 20, 10);
check('tax applies AFTER discount ((2500-500)*10% = 200)', approx($t['tax'], 200));

$t = pf_invoice_totals($items, 0, 0, 1000);
check('previous balance rolls into grandTotal', approx($t['grandTotal'], 3500));

$t = pf_invoice_totals($items, 0, 0, 0, 2500);
check('fully paid => status paid', $t['status'] === 'paid');
check('fully paid => balanceDue 0', approx($t['balanceDue'], 0));

$t = pf_invoice_totals($items, 0, 0, 0, 1000);
check('part paid => status partial', $t['status'] === 'partial');
check('part paid => balanceDue 1500', approx($t['balanceDue'], 1500));

$t = pf_invoice_totals([
    ['description' => 'A', 'qty' => 2, 'unitPrice' => 300],
    ['description' => 'B', 'qty' => 3, 'unitPrice' => 150],
]);
check('multi-item subtotal 2*300 + 3*150 = 1050', approx($t['subtotal'], 1050));

$t = pf_invoice_totals('[{"description":"JSON","qty":1,"unitPrice":100}]');
check('accepts items as JSON string', approx($t['subtotal'], 100));

$t = pf_invoice_totals([['name' => 'Named service', 'qty' => 1, 'unitPrice' => 50]]);
check('item name backfills description', $t['items'][0]['description'] === 'Named service');

throws('rejects discount > 100', fn() => pf_invoice_totals($items, 101));
throws('rejects negative discount', fn() => pf_invoice_totals($items, -1));
throws('rejects zero qty', fn() => pf_invoice_totals([['qty' => 0, 'unitPrice' => 10]]));
throws('rejects negative unit price', fn() => pf_invoice_totals([['qty' => 1, 'unitPrice' => -5]]));
throws('rejects overpayment', fn() => pf_invoice_totals($items, 0, 0, 0, 99999));
throws('rejects negative payment', fn() => pf_invoice_totals($items, 0, 0, 0, -1));

// ---------------------------------------------------------------------------
echo "== jwt ==\n";
$tok = jwt_sign_access(['id' => 'u1', 'clinicId' => 'c1', 'role' => 'owner']);
$decoded = jwt_verify_access($tok);
check('sign/verify roundtrip preserves claims', $decoded['id'] === 'u1' && $decoded['clinicId'] === 'c1');
check('exp claim set in the future', $decoded['exp'] > time());

throws('tampered payload rejected', function () use ($tok) {
    $p = explode('.', $tok);
    $forged = json_decode(base64url_decode($p[1]), true);
    $forged['role'] = 'superadmin';
    $p[1] = base64url_encode(json_encode($forged));
    jwt_verify_access(implode('.', $p));
}, 'Exception');
throws('garbage token rejected', fn() => jwt_verify_access('not.a.token'), 'Exception');
throws('access token invalid against refresh secret', fn() => jwt_verify_refresh($tok), 'Exception');

// ---------------------------------------------------------------------------
echo "== signed file urls ==\n";
$rel = 'clinic-x/photo.png';
$url = pf_file_signed_url($rel, 600);
$q = []; parse_str(parse_url($url, PHP_URL_QUERY), $q);
$tokenPart = basename(parse_url($url, PHP_URL_PATH));
check('signed url decodes back to the rel path', pf_b64url_decode(rawurldecode($tokenPart)) === $rel);
check('signature verifies for path|exp', hash_equals(pf_file_sig($rel, (int)$q['exp']), $q['sig']));
check('signature rejects a different path', !hash_equals(pf_file_sig('clinic-y/other.png', (int)$q['exp']), $q['sig']));
check('signature rejects a shifted expiry', !hash_equals(pf_file_sig($rel, (int)$q['exp'] + 1), $q['sig']));
check('uploads url converts to signed', strpos(pf_uploads_url_to_signed('/uploads/c/f.png'), API_PUBLIC_URL . '/files/') === 0);
check('external url passes through unchanged', pf_uploads_url_to_signed('https://x.test/i.png') === 'https://x.test/i.png');
check('null passes through', pf_uploads_url_to_signed(null) === null);

// ---------------------------------------------------------------------------
echo "== package gating ==\n";
check('AI-tier path /ai gated by aiEnabled', pf_feature_for_path('api/v1/ai/overview') === 'aiEnabled');
check('whatsapp path gated', pf_feature_for_path('api/v1/whatsapp/messages') === 'whatsappEnabled');
check('core path /invoices NOT gated', pf_feature_for_path('api/v1/invoices') === null);
$pk = pf_packages();
check('core + ai packages exist', isset($pk['core'], $pk['ai']));
check('core disables every AI flag', !array_filter(array_intersect_key($pk['core']['flags'], array_flip(['aiEnabled','whatsappEnabled','marketingEnabled','metaLeadsEnabled','importsEnabled']))));
check('ai enables the AI flags', $pk['ai']['flags']['aiEnabled'] && $pk['ai']['flags']['whatsappEnabled']);
check('ai plan includes every starter module', !array_diff($pk['core']['modules'], $pk['ai']['modules']));

// ---------------------------------------------------------------------------
echo "== username credentials ==\n";
check('username normalizes leading @ and case', pf_username_validate('@Front_Desk') === 'front_desk');
check('username seed sanitizes names', pf_username_sanitize_base('Dr. Smile Owner') === 'dr-smile-owner');
throws('username rejects email-shaped value', fn() => pf_username_validate('front@clinic.com'), 'InvalidArgumentException');

$usernameDb = new PDO('sqlite::memory:');
$usernameDb->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$usernameDb->exec("CREATE TABLE User (id TEXT PRIMARY KEY, email TEXT NOT NULL)");
$usernameDb->exec("INSERT INTO User (id, email) VALUES ('11111111-aaaa-bbbb-cccc-111111111111', 'one@example.test'), ('22222222-aaaa-bbbb-cccc-222222222222', 'two@example.test')");
$usernameDb->exec(file_get_contents(__DIR__ . '/../migrations/2026-07-14-usernames.sqlite.sql'));
$usernames = $usernameDb->query("SELECT username FROM User ORDER BY id")->fetchAll(PDO::FETCH_COLUMN);
check('username migration backfills existing accounts', $usernames === ['user-11111111', 'user-22222222']);
check('username availability sees existing usernames', !pf_username_available($usernameDb, 'user-11111111'));
check('username availability supports self-exclusion', pf_username_available($usernameDb, 'user-11111111', '11111111-aaaa-bbbb-cccc-111111111111'));

// ---------------------------------------------------------------------------
echo "== secure check-in integration ==\n";
$focusedCommand = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/checkin-token-tests.php');
passthru($focusedCommand, $focusedStatus);
check('focused secure check-in suite passes', $focusedStatus === 0);

// ---------------------------------------------------------------------------
echo "== operations-only safety integration ==\n";
$safetyCommand = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/clinical-safety-tests.php');
passthru($safetyCommand, $safetyStatus);
check('focused operations-only safety suite passes', $safetyStatus === 0);

// ---------------------------------------------------------------------------
echo "== industry template integration ==\n";
$templateCommand = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/industry-template-tests.php');
passthru($templateCommand, $templateStatus);
check('focused industry template suite passes', $templateStatus === 0);

// ---------------------------------------------------------------------------
echo "== migration runner integration ==\n";
$migrationCommand = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/migration-runner-tests.php');
passthru($migrationCommand, $migrationStatus);
check('focused migration runner suite passes', $migrationStatus === 0);

// ---------------------------------------------------------------------------
echo "\n$pass passed, $fail failed\n";
if ($fail) { echo 'FAILED: ' . implode(' | ', $failures) . "\n"; exit(1); }
exit(0);
