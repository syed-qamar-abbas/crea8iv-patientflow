<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../services/pdfService.php';
require_once __DIR__ . '/../services/invoiceMath.php';
require_once __DIR__ . '/../services/dentalFinancialService.php';

class InvoiceController {
    // Record the clinic's INTERNAL cost for an invoice (never shown to the
    // patient / not on the PDF). Feeds per-patient net profit + clinic P&L via
    // InvoiceProcedureCost. Only privileged roles may set it. Passing null skips.
    private function saveInternalCost($db, $user, $invoiceId, $clientId, $appointmentId, $procedureCost, $patientCharge) {
        // NOTE: do NOT run pf_dental_financials_ensure() here — its CREATE/ALTER
        // DDL would implicitly commit the caller's open transaction on MariaDB.
        // The InvoiceProcedureCost table is part of the base schema.
        if ($procedureCost === null || !pf_can_manage_procedure_costs($user)) return;
        $cost = max(0.0, floatval($procedureCost));
        $db->prepare("DELETE FROM InvoiceProcedureCost WHERE clinicId = ? AND invoiceId = ?")
           ->execute([$user['clinicId'], $invoiceId]);
        if ($cost > 0) {
            $db->prepare("INSERT INTO InvoiceProcedureCost (id, clinicId, invoiceId, invoiceItemIndex, appointmentId, clientId, patientCharge, procedureCost, createdBy) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)")
               ->execute([generate_uuid(), $user['clinicId'], $invoiceId, $appointmentId ?: null, $clientId, max(0.0, floatval($patientCharge)), $cost, $user['id'] ?? null]);
        }
    }

    private function assertAppointmentInClinic($db, $appointmentId, $clinicId, $clientId = null) {
        if (empty($appointmentId)) return;
        $sql = "SELECT id FROM Appointment WHERE id = ? AND clinicId = ?";
        $params = [$appointmentId, $clinicId];
        if ($clientId !== null && $clientId !== '') {
            $sql .= " AND clientId = ?";
            $params[] = $clientId;
        }
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        if (!$stmt->fetch()) {
            send_error('Appointment not found for this client/clinic', 400);
        }
    }

    private function generateInvoiceNo($db, $clinicId, $prefix = 'INV') {
        $safePrefix = preg_replace('/[^A-Z0-9-]/i', '', strtoupper($prefix ?: 'INV')) ?: 'INV';
        $date = date('Ymd');
        $pattern = "$safePrefix-$date-%";

        $stmtCount = $db->prepare("SELECT COUNT(*) FROM Invoice WHERE clinicId = ? AND invoiceNo LIKE ?");
        $stmtCount->execute([$clinicId, $pattern]);
        $seq = intval($stmtCount->fetchColumn()) + 1;

        $stmtExists = $db->prepare("SELECT id FROM Invoice WHERE invoiceNo = ? LIMIT 1");
        for ($attempt = 0; $attempt < 100; $attempt++) {
            $invoiceNo = sprintf('%s-%s-%04d', $safePrefix, $date, $seq + $attempt);
            $stmtExists->execute([$invoiceNo]);
            if (!$stmtExists->fetch()) {
                return $invoiceNo;
            }
        }

        return sprintf('%s-%s-%s', $safePrefix, $date, bin2hex(random_bytes(3)));
    }

    private function calculateTotals($items, $discountPercent = 0, $taxPercent = 0, $previousBalance = 0, $amountPaid = 0) {
        // Math lives in services/invoiceMath.php (pure + unit-tested);
        // this wrapper just maps validation failures to 400 responses.
        try {
            return pf_invoice_totals($items, $discountPercent, $taxPercent, $previousBalance, $amountPaid);
        } catch (InvalidArgumentException $e) {
            send_error($e->getMessage(), 400);
        }
    }

    private function recomputeClientTotals($db, $clinicId, $clientId) {
        if (empty($clientId)) {
            return;
        }

        $stmt = $db->prepare("
            SELECT invoiceNo, amountPaid, balanceDue, status, createdAt
            FROM Invoice
            WHERE clinicId = ? AND clientId = ? AND status NOT IN ('refunded', 'cancelled')
            ORDER BY createdAt DESC
        ");
        $stmt->execute([$clinicId, $clientId]);
        $rows = $stmt->fetchAll();

        $totalSpent = 0;
        $outstandingBalance = 0;
        $latestInvoiceNo = null;

        foreach ($rows as $idx => $row) {
            $totalSpent += floatval($row['amountPaid'] ?? 0);
            $outstandingBalance += floatval($row['balanceDue'] ?? 0);
            if ($idx === 0) {
                $latestInvoiceNo = $row['invoiceNo'];
            }
        }

        $stmtUpdate = $db->prepare("UPDATE Client SET totalSpent = ?, outstandingBalance = ?, latestInvoiceNo = ? WHERE id = ? AND clinicId = ?");
        $stmtUpdate->execute([$totalSpent, $outstandingBalance, $latestInvoiceNo, $clientId, $clinicId]);
    }

    public function list($input, $user) {
        $status = $_GET['status'] ?? '';
        $clientId = $_GET['clientId'] ?? '';
        $from = $_GET['from'] ?? '';
        $to = $_GET['to'] ?? '';
        $search = $_GET['search'] ?? '';
        $sort = $_GET['sort'] ?? 'date_desc';
        // Whitelisted sort options (default: newest invoice date first).
        $sortMap = [
            'date_desc'    => 'i.createdAt DESC',
            'date_asc'     => 'i.createdAt ASC',
            'amount_desc'  => 'i.grandTotal DESC',
            'amount_asc'   => 'i.grandTotal ASC',
            'balance_desc' => 'i.balanceDue DESC',
            'patient_asc'  => 'c.name ASC, i.createdAt DESC',
            'invoice_desc' => 'i.invoiceNo DESC',
        ];
        $orderBy = $sortMap[$sort] ?? $sortMap['date_desc'];
        $paginated = ($_GET['paginated'] ?? '') === 'true';
        $hasExplicitLimit = isset($_GET['limit']);
        $page = max(1, intval($_GET['page'] ?? 1));
        $limit = min(100, max(10, intval($_GET['limit'] ?? 50)));
        $offset = ($page - 1) * $limit;

        $db = DB::getConnection();
        $where = ["i.clinicId = ?"];
        $params = [$user['clinicId']];

        if (!empty($status)) {
            $where[] = "i.status = ?";
            $params[] = $status;
        }
        if (!empty($clientId)) {
            $where[] = "i.clientId = ?";
            $params[] = $clientId;
        }
        if (!empty($from) && !empty($to)) {
            $where[] = "i.createdAt >= ? AND i.createdAt <= ?";
            $params[] = $from . ' 00:00:00';
            $params[] = $to . ' 23:59:59';
        }
        if (!empty($search)) {
            $where[] = "(i.invoiceNo LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)";
            $like = "%$search%";
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $whereSql = implode(" AND ", $where);

        $countSql = "SELECT COUNT(*)
                     FROM Invoice i
                     LEFT JOIN Client c ON i.clientId = c.id AND c.clinicId = i.clinicId
                     WHERE $whereSql";
        $stmtCount = $db->prepare($countSql);
        $stmtCount->execute($params);
        $total = intval($stmtCount->fetchColumn());

        // Receptionists need invoice-level amounts to prepare and collect bills,
        // but clinic-wide totals are business financial analytics. Do not even
        // calculate those aggregates for roles that cannot manage financials.
        $canSeeAggregateFinancials = in_array($user['role'] ?? '', ['owner', 'manager', 'accountant'], true);
        $stats = null;
        $patientDues = null;
        if ($canSeeAggregateFinancials) {
            $statsSql = "SELECT COALESCE(SUM(i.grandTotal), 0) AS invoiced,
                                COALESCE(SUM(i.amountPaid), 0) AS paid,
                                COALESCE(SUM(i.balanceDue), 0) AS balance
                         FROM Invoice i
                         LEFT JOIN Client c ON i.clientId = c.id AND c.clinicId = i.clinicId
                         WHERE $whereSql";
            $stmtStats = $db->prepare($statsSql);
            $stmtStats->execute($params);
            $stats = $stmtStats->fetch() ?: ['invoiced' => 0, 'paid' => 0, 'balance' => 0];

            $stmtDues = $db->prepare("SELECT COALESCE(SUM(outstandingBalance), 0) FROM Client WHERE clinicId = ? AND status != 'inactive'");
            $stmtDues->execute([$user['clinicId']]);
            $patientDues = floatval($stmtDues->fetchColumn() ?: 0);
        }
        
        $sql = "SELECT i.*,
                       (SELECT COALESCE(SUM(procedureCost), 0) FROM InvoiceProcedureCost pc WHERE pc.invoiceId = i.id AND pc.clinicId = i.clinicId) AS procedureCost,
                       c.name as clientName, c.phone as clientPhone,
                       cl.id as clinic_id, cl.name as clinic_name, cl.tagline as clinic_tagline,
                       cl.logo as clinic_logo, cl.address as clinic_address, cl.phone as clinic_phone,
                       cl.email as clinic_email, cl.website as clinic_website, cl.registrationNo as clinic_registrationNo,
                       cl.invoicePrefix as clinic_invoicePrefix, cl.invoiceFooter as clinic_invoiceFooter,
                       cl.paymentTerms as clinic_paymentTerms, cl.primaryColor as clinic_primaryColor,
                       cl.secondaryColor as clinic_secondaryColor, cl.font as clinic_font
                FROM Invoice i
                LEFT JOIN Client c ON i.clientId = c.id AND c.clinicId = i.clinicId
                LEFT JOIN Clinic cl ON cl.id = i.clinicId
                WHERE $whereSql
                ORDER BY $orderBy";
        if ($paginated || $hasExplicitLimit) {
            $sql .= " LIMIT $limit OFFSET $offset";
        }

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $invoices = $stmt->fetchAll();

        // The internal procedure cost is privileged — strip it for other roles.
        $canCost = pf_can_manage_procedure_costs($user);
        if (!$canCost) { foreach ($invoices as &$_iv) { unset($_iv['procedureCost']); } unset($_iv); }

        $formatted = [];
        foreach ($invoices as $row) {
            $row['client'] = [
                'id' => $row['clientId'],
                'name' => $row['clientName'],
                'phone' => $row['clientPhone']
            ];
            $row['clinic'] = [
                'id' => $row['clinic_id'],
                'name' => $row['clinic_name'],
                'tagline' => $row['clinic_tagline'],
                'logo' => $row['clinic_logo'],
                'address' => $row['clinic_address'],
                'phone' => $row['clinic_phone'],
                'email' => $row['clinic_email'],
                'website' => $row['clinic_website'],
                'registrationNo' => $row['clinic_registrationNo'],
                'invoicePrefix' => $row['clinic_invoicePrefix'],
                'invoiceFooter' => $row['clinic_invoiceFooter'],
                'paymentTerms' => $row['clinic_paymentTerms'],
                'primaryColor' => $row['clinic_primaryColor'],
                'secondaryColor' => $row['clinic_secondaryColor'],
                'font' => $row['clinic_font'],
            ];
            unset(
                $row['clientName'], $row['clientPhone'],
                $row['clinic_id'], $row['clinic_name'], $row['clinic_tagline'], $row['clinic_logo'],
                $row['clinic_address'], $row['clinic_phone'], $row['clinic_email'], $row['clinic_website'],
                $row['clinic_registrationNo'], $row['clinic_invoicePrefix'], $row['clinic_invoiceFooter'],
                $row['clinic_paymentTerms'], $row['clinic_primaryColor'], $row['clinic_secondaryColor'], $row['clinic_font']
            );
            $row['items'] = json_decode($row['items'], true) ?: [];
            $formatted[] = $row;
        }

        if ($paginated) {
            $response = [
                'invoices' => $formatted,
                'total' => $total,
                'page' => $page,
                'pages' => max(1, (int)ceil($total / $limit)),
                'limit' => $limit,
            ];
            if ($canSeeAggregateFinancials) {
                $response['stats'] = [
                    'invoiced' => floatval($stats['invoiced'] ?? 0),
                    'paid' => floatval($stats['paid'] ?? 0),
                    'balance' => floatval($stats['balance'] ?? 0),
                    'patientDues' => $patientDues,
                ];
            }
            send_json($response);
        }
        send_json($formatted);
    }

    public function getById($input, $user, $id) {
        $db = DB::getConnection();
        $sql = "SELECT i.*,
                       c.id as c_id, c.name as c_name, c.phone as c_phone, c.email as c_email, c.dob as c_dob, c.gender as c_gender, c.patientNo as c_patientNo, c.avatarColor as c_avatarColor, c.initials as c_initials, c.outstandingBalance as c_outstandingBalance,
                       a.id as a_id, a.date as a_date, a.startTime as a_startTime, a.endTime as a_endTime, a.status as a_status
                FROM Invoice i
                LEFT JOIN Client c ON i.clientId = c.id AND c.clinicId = i.clinicId
                LEFT JOIN Appointment a ON i.appointmentId = a.id AND a.clinicId = i.clinicId
                WHERE i.id = ? AND i.clinicId = ?";
        
        $stmt = $db->prepare($sql);
        $stmt->execute([$id, $user['clinicId']]);
        $row = $stmt->fetch();

        if (!$row) {
            send_error('Invoice not found', 404);
        }

        $row['items'] = json_decode($row['items'], true) ?: [];
        $row['client'] = [
            'id' => $row['c_id'],
            'name' => $row['c_name'],
            'phone' => $row['c_phone'],
            'email' => $row['c_email'],
            'dob' => $row['c_dob'],
            'gender' => $row['c_gender'],
            'patientNo' => $row['c_patientNo'],
            'avatarColor' => $row['c_avatarColor'],
            'initials' => $row['c_initials'],
            'outstandingBalance' => floatval($row['c_outstandingBalance'])
        ];
        
        if ($row['appointmentId']) {
            $row['appointment'] = [
                'id' => $row['a_id'],
                'date' => $row['a_date'],
                'startTime' => $row['a_startTime'],
                'endTime' => $row['a_endTime'],
                'status' => $row['a_status']
            ];
        } else {
            $row['appointment'] = null;
        }

        unset(
            $row['c_id'], $row['c_name'], $row['c_phone'], $row['c_email'], $row['c_dob'], $row['c_gender'], $row['c_patientNo'], $row['c_avatarColor'], $row['c_initials'], $row['c_outstandingBalance'],
            $row['a_id'], $row['a_date'], $row['a_startTime'], $row['a_endTime'], $row['a_status']
        );

        send_json($row);
    }

    public function create($input, $user) {
        $clientId = $input['clientId'] ?? '';
        $appointmentId = $input['appointmentId'] ?? null;
        $items = $input['items'] ?? [];
        $discount = floatval($input['discount'] ?? 0);
        $tax = floatval($input['tax'] ?? 0);
        $paymentMethod = $input['paymentMethod'] ?? null;
        $notes = $input['notes'] ?? null;
        $dueDate = $input['dueDate'] ?? null;
        $amountPaid = floatval($input['amountPaid'] ?? 0);

        if (empty($clientId)) {
            send_error('clientId is required', 400);
        }
        if ($amountPaid < 0 || $discount < 0 || $tax < 0) {
            send_error('Amounts and percentages cannot be negative', 400);
        }

        $db = DB::getConnection();
        
        // Find client
        $stmtClient = $db->prepare("SELECT * FROM Client WHERE id = ? AND clinicId = ?");
        $stmtClient->execute([$clientId, $user['clinicId']]);
        $client = $stmtClient->fetch();

        if (!$client) {
            send_error('Client not found', 404);
        }
        $this->assertAppointmentInClinic($db, $appointmentId, $user['clinicId'], $clientId);

        // Find Clinic prefix
        $stmtClinic = $db->prepare("SELECT invoicePrefix FROM Clinic WHERE id = ?");
        $stmtClinic->execute([$user['clinicId']]);
        $prefix = $stmtClinic->fetchColumn() ?: 'INV';

        $previousBalance = floatval($client['outstandingBalance'] ?? 0);
        $totals = $this->calculateTotals($items, $discount, $tax, $previousBalance, $amountPaid);

        $invoiceId = generate_uuid();
        $invoiceNo = $this->generateInvoiceNo($db, $user['clinicId'], $prefix);

        try {
            $db->beginTransaction();

            $stmtInsert = $db->prepare("
                INSERT INTO Invoice (id, clinicId, clientId, appointmentId, invoiceNo, items, subtotal, previousBalance, discount, tax, total, grandTotal, amountPaid, balanceDue, status, paymentMethod, notes, dueDate)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmtInsert->execute([
                $invoiceId, $user['clinicId'], $clientId, $appointmentId, $invoiceNo, json_encode($totals['items']), $totals['subtotal'], $previousBalance, $totals['discount'], $totals['tax'], $totals['total'], $totals['grandTotal'], $totals['amountPaid'], $totals['balanceDue'], $totals['status'], $paymentMethod, $notes, $dueDate
            ]);

            if (array_key_exists('procedureCost', $input)) {
                $this->saveInternalCost($db, $user, $invoiceId, $clientId, $appointmentId, $input['procedureCost'], $totals['grandTotal']);
            }

            $this->recomputeClientTotals($db, $user['clinicId'], $clientId);

            $db->commit();

            $stmtFetch = $db->prepare("SELECT * FROM Invoice WHERE id = ? AND clinicId = ?");
            $stmtFetch->execute([$invoiceId, $user['clinicId']]);
            $createdInvoice = $stmtFetch->fetch();
            $createdInvoice['items'] = json_decode($createdInvoice['items'], true) ?: [];

            send_json($createdInvoice, 201);
        } catch (Exception $e) {
            $db->rollBack();
            send_error($e->getMessage(), 500);
        }
    }

    public function update($input, $user, $id) {
        $db = DB::getConnection();

        $stmtExisting = $db->prepare("SELECT * FROM Invoice WHERE id = ? AND clinicId = ?");
        $stmtExisting->execute([$id, $user['clinicId']]);
        $existing = $stmtExisting->fetch();

        if (!$existing) {
            send_error('Invoice not found', 404);
        }

        $clientId = $input['clientId'] ?? $existing['clientId'];
        $appointmentId = array_key_exists('appointmentId', $input) ? ($input['appointmentId'] ?: null) : $existing['appointmentId'];
        $items = array_key_exists('items', $input) ? $input['items'] : (json_decode($existing['items'], true) ?: []);
        $discountPercent = floatval($input['discountPercent'] ?? $input['discountRate'] ?? $input['discount'] ?? 0);
        $taxPercent = floatval($input['taxPercent'] ?? $input['taxRate'] ?? $input['tax'] ?? 0);
        $previousBalance = floatval($input['previousBalance'] ?? $existing['previousBalance']);
        $amountPaid = floatval($input['amountPaid'] ?? $existing['amountPaid']);
        $paymentMethod = array_key_exists('paymentMethod', $input) ? $input['paymentMethod'] : $existing['paymentMethod'];
        $notes = array_key_exists('notes', $input) ? $input['notes'] : $existing['notes'];
        $dueDate = array_key_exists('dueDate', $input) ? ($input['dueDate'] ?: null) : $existing['dueDate'];
        $status = $input['status'] ?? null;
        if ($amountPaid < 0 || $discountPercent < 0 || $taxPercent < 0 || $previousBalance < 0) {
            send_error('Amounts and percentages cannot be negative', 400);
        }
        if ($status !== null && !in_array($status, ['pending', 'partial', 'paid', 'refunded', 'cancelled'], true)) {
            send_error('Invalid invoice status', 400);
        }

        $stmtClient = $db->prepare("SELECT id FROM Client WHERE id = ? AND clinicId = ?");
        $stmtClient->execute([$clientId, $user['clinicId']]);
        if (!$stmtClient->fetch()) {
            send_error('Client not found', 404);
        }
        $this->assertAppointmentInClinic($db, $appointmentId, $user['clinicId'], $clientId);

        $totals = $this->calculateTotals($items, $discountPercent, $taxPercent, $previousBalance, $amountPaid);
        $finalStatus = $status ?: $totals['status'];
        $paidAt = $finalStatus === 'paid' ? ($existing['paidAt'] ?: date('Y-m-d H:i:s')) : null;

        try {
            $db->beginTransaction();

            $stmtUpdate = $db->prepare("
                UPDATE Invoice
                SET clientId = ?, appointmentId = ?, items = ?, subtotal = ?, previousBalance = ?, discount = ?, tax = ?, total = ?, grandTotal = ?, amountPaid = ?, balanceDue = ?, status = ?, paymentMethod = ?, notes = ?, dueDate = ?, paidAt = ?
                WHERE id = ? AND clinicId = ?
            ");
            $stmtUpdate->execute([
                $clientId,
                $appointmentId,
                json_encode($totals['items']),
                $totals['subtotal'],
                $previousBalance,
                $totals['discount'],
                $totals['tax'],
                $totals['total'],
                $totals['grandTotal'],
                $totals['amountPaid'],
                $totals['balanceDue'],
                $finalStatus,
                $paymentMethod,
                $notes,
                $dueDate,
                $paidAt,
                $id,
                $user['clinicId']
            ]);

            if (array_key_exists('procedureCost', $input)) {
                $this->saveInternalCost($db, $user, $id, $clientId, $appointmentId, $input['procedureCost'], $totals['grandTotal']);
            }

            $this->recomputeClientTotals($db, $user['clinicId'], $existing['clientId']);
            if ($clientId !== $existing['clientId']) {
                $this->recomputeClientTotals($db, $user['clinicId'], $clientId);
            }

            $db->commit();

            $stmtFetch = $db->prepare("SELECT * FROM Invoice WHERE id = ? AND clinicId = ?");
            $stmtFetch->execute([$id, $user['clinicId']]);
            $updated = $stmtFetch->fetch();
            $updated['items'] = json_decode($updated['items'], true) ?: [];

            send_json($updated);
        } catch (Exception $e) {
            $db->rollBack();
            send_error($e->getMessage(), 500);
        }
    }

    public function markPaid($input, $user, $id) {
        $paymentMethod = $input['paymentMethod'] ?? null;
        $amountPaid = isset($input['amountPaid']) ? floatval($input['amountPaid']) : null;
        if ($amountPaid !== null && $amountPaid < 0) {
            send_error('amountPaid cannot be negative', 400);
        }

        $db = DB::getConnection();
        
        $stmt = $db->prepare("SELECT * FROM Invoice WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        $existing = $stmt->fetch();

        if (!$existing) {
            send_error('Invoice not found', 404);
        }

        $grandTotal = floatval($existing['grandTotal'] ?: $existing['total']);
        $paid = $amountPaid === null ? $grandTotal : $amountPaid;
        $balanceDue = max(0.0, $grandTotal - $paid);
        $status = $balanceDue <= 0 ? 'paid' : 'partial';
        $paidAt = $balanceDue <= 0 ? date('Y-m-d H:i:s') : null;

        $diffPaid = max(0.0, $paid - floatval($existing['amountPaid']));

        try {
            $db->beginTransaction();

            $stmtUpdate = $db->prepare("UPDATE Invoice SET status = ?, amountPaid = ?, balanceDue = ?, paymentMethod = ?, paidAt = ? WHERE id = ? AND clinicId = ?");
            $stmtUpdate->execute([$status, $paid, $balanceDue, $paymentMethod, $paidAt, $id, $user['clinicId']]);

            $this->recomputeClientTotals($db, $user['clinicId'], $existing['clientId']);

            $db->commit();

            $stmtFetch = $db->prepare("SELECT * FROM Invoice WHERE id = ? AND clinicId = ?");
            $stmtFetch->execute([$id, $user['clinicId']]);
            $updated = $stmtFetch->fetch();
            $updated['items'] = json_decode($updated['items'], true) ?: [];

            send_json($updated);
        } catch (Exception $e) {
            $db->rollBack();
            send_error($e->getMessage(), 500);
        }
    }

    public function refund($input, $user, $id) {
        $db = DB::getConnection();
        
        $stmt = $db->prepare("SELECT clientId, amountPaid FROM Invoice WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        $invoice = $stmt->fetch();
        if (!$invoice) {
            send_error('Invoice not found', 404);
        }

        try {
            $db->beginTransaction();

            $stmtUpdate = $db->prepare("UPDATE Invoice SET status = 'refunded' WHERE id = ? AND clinicId = ?");
            $stmtUpdate->execute([$id, $user['clinicId']]);

            $this->recomputeClientTotals($db, $user['clinicId'], $invoice['clientId']);

            log_audit($user['clinicId'], $user['id'] ?? null, 'invoice_refunded', 'Invoice', $id, null, ['amount' => $invoice['amountPaid'], 'by' => $user['role'] ?? '']);
            $db->commit();
            send_json(['message' => 'Refunded']);
        } catch (Exception $e) {
            $db->rollBack();
            send_error($e->getMessage(), 500);
        }
    }

    public function remove($input, $user, $id) {
        $db = DB::getConnection();

        $stmt = $db->prepare("SELECT clientId FROM Invoice WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        $invoice = $stmt->fetch();

        if (!$invoice) {
            send_error('Invoice not found', 404);
        }

        try {
            $db->beginTransaction();

            $stmtArchive = $db->prepare("UPDATE Invoice SET status = 'cancelled', balanceDue = 0 WHERE id = ? AND clinicId = ?");
            $stmtArchive->execute([$id, $user['clinicId']]);

            $this->recomputeClientTotals($db, $user['clinicId'], $invoice['clientId']);

            log_audit($user['clinicId'], $user['id'] ?? null, 'invoice_archived', 'Invoice', $id, null, ['by' => $user['role'] ?? '']);
            $db->commit();
            send_json(['message' => 'Invoice archived']);
        } catch (Exception $e) {
            $db->rollBack();
            send_error($e->getMessage(), 500);
        }
    }

    public function getPDF($input, $user, $id) {
        $db = DB::getConnection();
        
        // Find invoice
        $stmtInvoice = $db->prepare("SELECT * FROM Invoice WHERE id = ? AND clinicId = ?");
        $stmtInvoice->execute([$id, $user['clinicId']]);
        $invoice = $stmtInvoice->fetch();
        if (!$invoice) {
            send_error('Invoice not found', 404);
        }

        // Find client
        $stmtClient = $db->prepare("SELECT * FROM Client WHERE id = ? AND clinicId = ?");
        $stmtClient->execute([$invoice['clientId'], $user['clinicId']]);
        $client = $stmtClient->fetch();

        // Find clinic
        $stmtClinic = $db->prepare("SELECT * FROM Clinic WHERE id = ?");
        $stmtClinic->execute([$user['clinicId']]);
        $clinic = $stmtClinic->fetch();

        try {
            $pdfContent = generateInvoicePDF($invoice, $client, $clinic);

            header('Content-Type: application/pdf');
            header('Content-Disposition: attachment; filename="' . $invoice['invoiceNo'] . '.pdf"');
            // Never cache invoice PDFs — they must always reflect the latest clinic
            // payment details / branding, so a freshly-added bank account shows up
            // on EVERY invoice (paid or pending), not a stale browser copy.
            header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
            header('Pragma: no-cache');
            header('Expires: 0');
            echo $pdfContent;
            exit;
        } catch (Exception $e) {
            send_error($e->getMessage(), 500);
        }
    }
}
