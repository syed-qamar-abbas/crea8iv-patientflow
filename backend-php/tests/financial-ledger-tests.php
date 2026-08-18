<?php
error_reporting(E_ALL);
putenv('APP_ENV=development');
putenv('DB_DRIVER=sqlite');
putenv('DB_PATH=:memory:');
putenv('JWT_SECRET=test-secret-please-ignore-0123456789abcdef');
putenv('JWT_REFRESH_SECRET=test-refresh-secret-0123456789abcdef00');

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../services/invoicePaymentService.php';

$passed = 0; $failed = 0;
function ledger_check($name, $condition) {
    global $passed, $failed;
    if ($condition) { $passed++; echo "  ok  $name\n"; }
    else { $failed++; echo "FAIL  $name\n"; }
}

$db = new PDO('sqlite::memory:');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
$db->exec('PRAGMA foreign_keys = ON');
$db->exec('CREATE TABLE Clinic (id TEXT PRIMARY KEY)');
$db->exec('CREATE TABLE User (id TEXT PRIMARY KEY)');
$db->exec('CREATE TABLE Client (id TEXT PRIMARY KEY, clinicId TEXT NOT NULL)');
$db->exec('CREATE TABLE Invoice (
    id TEXT PRIMARY KEY, clinicId TEXT NOT NULL, clientId TEXT NOT NULL,
    amountPaid REAL NOT NULL DEFAULT 0, status TEXT NOT NULL,
    paymentMethod TEXT, paidAt TEXT, createdAt TEXT NOT NULL
)');

$oldDate = date('Y-m-d H:i:s', strtotime('first day of last month 12:00:00'));
$db->exec("INSERT INTO Clinic (id) VALUES ('c1')");
$db->exec("INSERT INTO Client (id, clinicId) VALUES ('p1', 'c1')");
$insert = $db->prepare('INSERT INTO Invoice (id, clinicId, clientId, amountPaid, status, paymentMethod, paidAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
$insert->execute(['i-active', 'c1', 'p1', 1000, 'partial', 'Cash', null, $oldDate]);
$insert->execute(['i-refunded', 'c1', 'p1', 500, 'refunded', 'Cash', null, $oldDate]);

$db->exec(file_get_contents(__DIR__ . '/../migrations/2026-08-18-invoice-payment-ledger.sqlite.sql'));
ledger_check('migration backfills active invoice collections', abs(pf_invoice_payment_sum($db, 'c1') - 1000) < 0.001);
ledger_check('migration excludes already-refunded legacy invoices', (int)$db->query("SELECT COUNT(*) FROM InvoicePaymentEntry WHERE invoiceId = 'i-refunded'")->fetchColumn() === 0);

$lastMonthStart = date('Y-m-01 00:00:00', strtotime('last month'));
$lastMonthEnd = date('Y-m-t 23:59:59', strtotime('last month'));
$thisMonthStart = date('Y-m-01 00:00:00');
$thisMonthEnd = date('Y-m-t 23:59:59');
ledger_check('legacy collection remains in original month', abs(pf_invoice_payment_sum($db, 'c1', $lastMonthStart, $lastMonthEnd) - 1000) < 0.001);
ledger_check('old invoice does not leak cumulative amount into this month', abs(pf_invoice_payment_sum($db, 'c1', $thisMonthStart, $thisMonthEnd)) < 0.001);

pf_record_invoice_payment_event($db, 'c1', 'i-active', 'p1', 400, 'payment', 'Bank Transfer');
ledger_check('new partial payment is attributed to current month', abs(pf_invoice_payment_sum($db, 'c1', $thisMonthStart, $thisMonthEnd) - 400) < 0.001);

pf_record_invoice_payment_event($db, 'c1', 'i-active', 'p1', -150, 'refund', 'Bank Transfer');
ledger_check('refund reduces collection in the month it occurs', abs(pf_invoice_payment_sum($db, 'c1', $thisMonthStart, $thisMonthEnd) - 250) < 0.001);

echo "$passed passed, $failed failed\n";
exit($failed ? 1 : 0);
