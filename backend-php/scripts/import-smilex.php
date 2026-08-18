<?php
// One-off importer for The Smile Xperts historical data (Google Sheet).
// Reads /tmp/smilex_import.json and inserts doctors (Staff), patients (Client),
// visits (Appointment), and paid Invoices for the clinic. Idempotent: refuses
// to run twice (detects the import marker) unless given --force. Everything it
// writes is tagged so it can be identified/removed.
//
// Usage: php scripts/import-smilex.php [--force] [--dry]

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../services/invoicePaymentService.php';

$CLINIC_ID = 'clinic-smile-expert-001';
$MARKER    = 'Imported: Google Sheet (Nov-Dec 2025)';
$TAG       = '[gsheet-import]';
$force = in_array('--force', $argv, true);
$dry   = in_array('--dry', $argv, true);

$data = json_decode(file_get_contents('/tmp/smilex_import.json'), true);
if (!$data) { fwrite(STDERR, "Cannot read /tmp/smilex_import.json\n"); exit(1); }

$db = DB::getConnection();

// Guard: clinic exists
$stmt = $db->prepare("SELECT id, name FROM Clinic WHERE id = ?");
$stmt->execute([$CLINIC_ID]);
$clinic = $stmt->fetch();
if (!$clinic) { fwrite(STDERR, "Clinic $CLINIC_ID not found\n"); exit(1); }

// Idempotency guard
$stmt = $db->prepare("SELECT COUNT(*) FROM Client WHERE clinicId = ? AND referredBy = ?");
$stmt->execute([$CLINIC_ID, $MARKER]);
$already = (int)$stmt->fetchColumn();
if ($already > 0 && !$force) {
    fwrite(STDERR, "Already imported ($already tagged patients). Re-run with --force to import again.\n");
    exit(2);
}

$avatarColors = ['#0891b2','#0f766e','#7c3aed','#db2777','#ea580c','#2563eb','#16a34a','#9333ea'];
function initialsOf($name) {
    $parts = preg_split('/\s+/', trim($name));
    $skip = ['mr','mrs','ms','dr','miss','prof'];
    $parts = array_values(array_filter($parts, fn($p) => !in_array(strtolower(rtrim($p,'.')), $skip)));
    if (!$parts) $parts = preg_split('/\s+/', trim($name));
    $a = strtoupper(substr($parts[0] ?? '', 0, 1));
    $b = strtoupper(substr($parts[1] ?? '', 0, 1));
    return substr($a.$b, 0, 2) ?: 'P';
}

if ($dry) { echo "DRY RUN — no writes\n"; }

$db->beginTransaction();
try {
    // 1) Doctors -> Staff (deterministic ids, skip if present)
    $docMap = []; $docCreated = 0;
    foreach ($data['doctors'] as $base) {
        $id = 'imp-doc-' . strtolower($base);
        $name = 'Dr ' . $base;
        $docMap[$base] = $id;
        $chk = $db->prepare("SELECT id FROM Staff WHERE id = ?");
        $chk->execute([$id]);
        if ($chk->fetch()) continue;
        if (!$dry) {
            $db->prepare("INSERT INTO Staff (id, clinicId, name, role, designation, specialty, status, avatarColor, workingDays, workingHours, rating, compensationType, inviteStatus, bio)
                          VALUES (?, ?, ?, 'doctor', 'Dentist', 'dental', 'active', ?, 'Mon,Tue,Wed,Thu,Fri,Sat', '10:00-18:00', 5.00, 'commission', 'ready', ?)")
               ->execute([$id, $CLINIC_ID, $name, $avatarColors[$docCreated % count($avatarColors)], $TAG]);
        }
        $docCreated++;
    }

    // 2) Patients -> Client (continue patientNo sequence with IMP- prefix)
    $stmt = $db->prepare("SELECT COUNT(*) FROM Client WHERE clinicId = ? AND patientNo LIKE 'IMP-%'");
    $stmt->execute([$CLINIC_ID]);
    $seq = (int)$stmt->fetchColumn();

    $clientMap = []; $cliCreated = 0; $ci = 0;
    foreach ($data['patients'] as $p) {
        $key = strtolower($p['name']) . '|' . ($p['phone'] ?? '');
        $cid = generate_uuid();
        $clientMap[$key] = $cid;
        $seq++;
        $patientNo = 'IMP-' . str_pad((string)$seq, 4, '0', STR_PAD_LEFT);
        $notes = $TAG . (!empty($p['area']) ? ("\nArea: " . $p['area']) : '');
        if (!$dry) {
            $db->prepare("INSERT INTO Client (id, clinicId, patientNo, name, phone, email, dob, gender, specialty, medicalHistory, totalSpent, lastVisit, status, avatarColor, initials, notes, referredBy)
                          VALUES (?, ?, ?, ?, ?, '', NULL, NULL, '[\"dental\"]', '[]', ?, ?, 'active', ?, ?, ?, ?)")
               ->execute([$cid, $CLINIC_ID, $patientNo, $p['name'], $p['phone'] ?? '', (float)($p['total'] ?? 0),
                          $p['lastVisit'] ?? null, $avatarColors[$ci % count($avatarColors)], initialsOf($p['name']), $notes, $MARKER]);
        }
        $cliCreated++; $ci++;
    }

    // 3) Visits -> Appointment (+ paid Invoice when pay>0)
    $stmt = $db->prepare("SELECT COUNT(*) FROM Invoice WHERE clinicId = ? AND invoiceNo LIKE 'TSE-IMP-%'");
    $stmt->execute([$CLINIC_ID]);
    $invSeq = (int)$stmt->fetchColumn();

    // Fallback doctor for visits with no recognizable name (staffId is NOT NULL).
    $fallbackStaff = $docMap['Osama'] ?? (reset($docMap) ?: null);

    $apptCreated = 0; $invCreated = 0; $revenue = 0.0;
    foreach ($data['visits'] as $v) {
        $key = strtolower($v['name']) . '|' . ($v['phone'] ?? '');
        $cid = $clientMap[$key] ?? null;
        if (!$cid) continue; // shouldn't happen
        $staffId = (!empty($v['doc']) && isset($docMap[$v['doc']])) ? $docMap[$v['doc']] : $fallbackStaff;
        $apptId = generate_uuid();
        $date = $v['date'] ?: date('Y-m-d');
        $proc = $v['proc'] ?: 'Visit';
        $notes = $TAG . "\nProcedure: $proc" . (!empty($v['docRaw']) ? "\nDoctor: " . $v['docRaw'] : '');
        $price = (float)($v['pay'] ?? 0);
        if (!$dry) {
            $db->prepare("INSERT INTO Appointment (id, clinicId, clientId, staffId, serviceId, date, startTime, endTime, duration, status, notes, price, specialty)
                          VALUES (?, ?, ?, ?, NULL, ?, '10:00', '10:30', 30, 'completed', ?, ?, 'dental')")
               ->execute([$apptId, $CLINIC_ID, $cid, $staffId, $date, $notes, $price]);
        }
        $apptCreated++;

        if ($price > 0) {
            $invSeq++;
            $invoiceNo = 'TSE-IMP-' . str_pad((string)$invSeq, 4, '0', STR_PAD_LEFT);
            $items = json_encode([[ 'description' => $proc, 'qty' => 1, 'unitPrice' => $price, 'rate' => $price, 'amount' => $price ]]);
            $method = $v['method'] ?: 'Cash';
            if (!$dry) {
                $invoiceId = generate_uuid();
                $db->prepare("INSERT INTO Invoice (id, clinicId, clientId, appointmentId, invoiceNo, items, subtotal, previousBalance, discount, tax, total, grandTotal, amountPaid, balanceDue, status, paymentMethod, notes, paidAt, createdAt)
                              VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, 0, 'paid', ?, ?, ?, ?)")
                   ->execute([$invoiceId, $CLINIC_ID, $cid, $apptId, $invoiceNo, $items, $price, $price, $price, $price, $method, $TAG, $date.' 12:00:00', $date.' 12:00:00']);
                pf_record_invoice_payment_event(
                    $db, $CLINIC_ID, $invoiceId, $cid, $price, 'legacy', $method,
                    null, $date . ' 12:00:00', $TAG, 'legacy:' . $invoiceId
                );
            }
            $invCreated++; $revenue += $price;
        }
    }

    if ($dry) { $db->rollBack(); } else { $db->commit(); }

    echo "=== Import summary" . ($dry ? " (DRY)" : "") . " ===\n";
    echo "Doctors created : $docCreated\n";
    echo "Patients created: $cliCreated\n";
    echo "Appointments    : $apptCreated\n";
    echo "Paid invoices   : $invCreated\n";
    echo "Revenue recorded: PKR " . number_format($revenue) . "\n";
} catch (Exception $e) {
    $db->rollBack();
    fwrite(STDERR, "IMPORT FAILED: " . $e->getMessage() . "\n");
    exit(1);
}
