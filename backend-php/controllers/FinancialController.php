<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../services/dentalFinancialService.php';
require_once __DIR__ . '/../services/invoicePaymentService.php';

class FinancialController {
    private function ensure($user) {
        if (!pf_can_view_business_financials($user)) send_error('Insufficient permissions', 403);
        $db = DB::getConnection();
        pf_dental_financials_ensure($db);
        pf_seed_expense_categories($db, $user['clinicId']);
        return $db;
    }

    public function getSummary($input, $user) {
        $db = $this->ensure($user);

        // Optional date range — every figure below respects it. Empty = all time.
        $rawFrom = $_GET['from'] ?? '';
        $rawTo = $_GET['to'] ?? '';
        if (($rawFrom !== '' || $rawTo !== '') && (!pf_valid_date($rawFrom) || !pf_valid_date($rawTo) || $rawFrom > $rawTo)) {
            send_error('Invalid financial date range', 400);
        }
        $from = $rawFrom !== '' ? $rawFrom . ' 00:00:00' : null;
        $to = $rawTo !== '' ? $rawTo . ' 23:59:59' : null;

        // Cash-basis revenue: attribute money to the date it was actually paid,
        // including partial payments on invoices from an earlier month.
        $totalRevenue = pf_invoice_payment_sum($db, $user['clinicId'], $from, $to);

        // Outstanding is a current balance snapshot, so it must not disappear
        // merely because the invoice was created outside the selected report range.
        $stmtOutstanding = $db->prepare("SELECT COALESCE(SUM(balanceDue), 0) FROM Invoice
            WHERE clinicId = ? AND status IN ('pending', 'partial')");
        $stmtOutstanding->execute([$user['clinicId']]);
        $outstandingPayments = floatval($stmtOutstanding->fetchColumn() ?: 0);

        // General clinic expenses in range (by expense date).
        $expWhere = "clinicId = ? AND archivedAt IS NULL"; $expParams = [$user['clinicId']];
        if ($from && $to) { $expWhere .= " AND expenseDate >= ? AND expenseDate <= ?"; $expParams[] = substr($from, 0, 10); $expParams[] = substr($to, 0, 10); }
        $stmtExpense = $db->prepare("SELECT COALESCE(SUM(amount), 0) FROM Expense WHERE $expWhere");
        $stmtExpense->execute($expParams);
        $generalExpenses = floatval($stmtExpense->fetchColumn() ?: 0);

        // Procedure costs (internal), for invoices created in range.
        $pcWhere = "pc.clinicId = ?"; $pcParams = [$user['clinicId']];
        $pcWhere .= " AND i.status NOT IN ('refunded', 'cancelled')";
        if ($from && $to) { $pcWhere .= " AND i.createdAt >= ? AND i.createdAt <= ?"; $pcParams[] = $from; $pcParams[] = $to; }
        $stmtCost = $db->prepare("SELECT COALESCE(SUM(pc.procedureCost), 0) FROM InvoiceProcedureCost pc JOIN Invoice i ON i.id = pc.invoiceId AND i.clinicId = pc.clinicId WHERE $pcWhere");
        $stmtCost->execute($pcParams);
        $procedureCosts = floatval($stmtCost->fetchColumn() ?: 0);

        // Simple model: Expenses = general expenses + procedure costs; Profit = Revenue - Expenses.
        $totalExpensesAll = $generalExpenses + $procedureCosts;
        $profit = $totalRevenue - $totalExpensesAll;

        send_json([
            'totalRevenue' => $totalRevenue,
            'totalExpenses' => $totalExpensesAll,   // combined (general + procedure) — the "Expenses" card
            'generalExpenses' => $generalExpenses,
            'procedureCosts' => $procedureCosts,
            'profit' => $profit,                    // Revenue - Expenses — the "Profit" card
            'outstandingPayments' => $outstandingPayments,
            // Back-compat aliases:
            'grossProfit' => $totalRevenue - $procedureCosts,
            'netProfit' => $profit,
        ]);
    }

    public function getMonthly($input, $user) {
        $db = $this->ensure($user);
        
        $stmt = $db->prepare("
            SELECT p.amount, p.paidAt, a.specialty
            FROM InvoicePaymentEntry p
            JOIN Invoice i ON i.id = p.invoiceId AND i.clinicId = p.clinicId
            LEFT JOIN Appointment a ON i.appointmentId = a.id AND a.clinicId = i.clinicId
            WHERE p.clinicId = ? AND p.amount != 0
            ORDER BY p.paidAt ASC
        ");
        $stmt->execute([$user['clinicId']]);
        $invoices = $stmt->fetchAll();

        $monthly = [];
        foreach ($invoices as $inv) {
            $date = strtotime($inv['paidAt']);
            $monthKey = date('Y-m', $date);
            $month = date('M y', $date); // e.g. "Jun 26"
            
            if (!isset($monthly[$monthKey])) {
                $monthly[$monthKey] = [
                    'month' => $month,
                    'dental' => 0.0,
                    'revenue' => 0.0,
                    'generalExpenses' => 0.0,
                    'expenses' => 0.0,
                    'procedureCosts' => 0.0,
                    'grossProfit' => 0.0,
                    'netProfit' => 0.0,
                    'total' => 0.0
                ];
            }
            
            $specialty = !empty($inv['specialty']) ? $inv['specialty'] : 'dental';
            if (!isset($monthly[$monthKey][$specialty])) {
                $monthly[$monthKey][$specialty] = 0.0;
            }
            
            $amount = floatval($inv['amount']);
            $monthly[$monthKey][$specialty] += $amount;
            $monthly[$monthKey]['revenue'] += $amount;
            $monthly[$monthKey]['total'] += $amount;
        }

        $stmtExpense = $db->prepare("SELECT amount, expenseDate FROM Expense WHERE clinicId = ? AND archivedAt IS NULL");
        $stmtExpense->execute([$user['clinicId']]);
        foreach ($stmtExpense->fetchAll() as $row) {
            $date = strtotime($row['expenseDate']);
            $monthKey = date('Y-m', $date);
            $month = date('M y', $date);
            if (!isset($monthly[$monthKey])) {
                $monthly[$monthKey] = [
                    'month' => $month, 'dental' => 0.0, 'revenue' => 0.0, 'expenses' => 0.0,
                    'generalExpenses' => 0.0, 'procedureCosts' => 0.0, 'grossProfit' => 0.0, 'netProfit' => 0.0, 'total' => 0.0
                ];
            }
            $monthly[$monthKey]['generalExpenses'] += floatval($row['amount']);
        }

        $stmtCosts = $db->prepare("SELECT pc.procedureCost, i.createdAt
            FROM InvoiceProcedureCost pc
            JOIN Invoice i ON i.id = pc.invoiceId AND i.clinicId = pc.clinicId
            WHERE pc.clinicId = ? AND i.status NOT IN ('refunded', 'cancelled')");
        $stmtCosts->execute([$user['clinicId']]);
        foreach ($stmtCosts->fetchAll() as $row) {
            $date = strtotime($row['createdAt']);
            $monthKey = date('Y-m', $date);
            $month = date('M y', $date);
            if (!isset($monthly[$monthKey])) {
                $monthly[$monthKey] = [
                    'month' => $month, 'dental' => 0.0, 'revenue' => 0.0, 'expenses' => 0.0,
                    'generalExpenses' => 0.0, 'procedureCosts' => 0.0, 'grossProfit' => 0.0, 'netProfit' => 0.0, 'total' => 0.0
                ];
            }
            $monthly[$monthKey]['procedureCosts'] += floatval($row['procedureCost']);
        }

        foreach ($monthly as &$row) {
            $row['expenses'] = $row['generalExpenses'] + $row['procedureCosts'];
            $row['grossProfit'] = $row['revenue'] - $row['procedureCosts'];
            $row['netProfit'] = $row['revenue'] - $row['expenses'];
        }
        unset($row);

        ksort($monthly);
        send_json(array_values($monthly));
    }

    public function getTransactions($input, $user) {
        $page = max(1, isset($_GET['page']) ? intval($_GET['page']) : 1);
        $limit = min(100, max(1, isset($_GET['limit']) ? intval($_GET['limit']) : 20));
        $offset = ($page - 1) * $limit;

        $db = $this->ensure($user);
        
        $sql = "SELECT i.*, 
                       c.name as clientName,
                       a.specialty, 
                       srv.name as serviceName
                FROM Invoice i
                LEFT JOIN Client c ON i.clientId = c.id AND c.clinicId = i.clinicId
                LEFT JOIN Appointment a ON i.appointmentId = a.id AND a.clinicId = i.clinicId
                LEFT JOIN Service srv ON a.serviceId = srv.id AND srv.clinicId = i.clinicId
                WHERE i.clinicId = ? AND i.status NOT IN ('refunded', 'cancelled')
                ORDER BY i.createdAt DESC
                LIMIT ? OFFSET ?";
        
        $stmt = $db->prepare($sql);
        $stmt->bindValue(1, $user['clinicId']);
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
        $stmt->bindValue(3, $offset, PDO::PARAM_INT);
        $stmt->execute();
        $invoices = $stmt->fetchAll();

        $formatted = [];
        foreach ($invoices as $row) {
            $row['client'] = ['name' => $row['clientName']];
            $row['appointment'] = [
                'specialty' => $row['specialty'],
                'service' => ['name' => $row['serviceName']]
            ];
            $row['items'] = json_decode($row['items'], true) ?: [];
            
            unset($row['clientName'], $row['specialty'], $row['serviceName']);
            $formatted[] = $row;
        }

        send_json($formatted);
    }

    public function getProcedureExpenses($input, $user) {
        $db = $this->ensure($user);
        $from = $_GET['from'] ?? date('Y-m-01');
        $to = $_GET['to'] ?? date('Y-m-t');
        if (!pf_valid_date($from) || !pf_valid_date($to) || $from > $to) send_error('Invalid date range', 400);

        $page = max(1, intval($_GET['page'] ?? 1));
        $limit = min(100, max(1, intval($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $params = [$user['clinicId'], $from . ' 00:00:00', $to . ' 23:59:59'];
        $where = "pc.clinicId = ? AND i.status NOT IN ('refunded', 'cancelled') AND i.createdAt >= ? AND i.createdAt <= ?";

        $stmtTotals = $db->prepare("SELECT COUNT(*), COALESCE(SUM(pc.procedureCost), 0)
            FROM InvoiceProcedureCost pc JOIN Invoice i ON i.id = pc.invoiceId AND i.clinicId = pc.clinicId
            WHERE $where");
        $stmtTotals->execute($params);
        $totals = $stmtTotals->fetch(PDO::FETCH_NUM) ?: [0, 0];
        $total = intval($totals[0]);

        $descriptionExpr = DB_DRIVER === 'sqlite'
            ? "COALESCE(s.name, 'Invoice item')"
            : "COALESCE(s.name, JSON_UNQUOTE(JSON_EXTRACT(i.items, CONCAT('$[', pc.invoiceItemIndex, '].description'))), 'Invoice item')";
        $stmt = $db->prepare("SELECT pc.id, pc.invoiceId, pc.invoiceItemIndex, pc.patientCharge, pc.procedureCost,
                pc.notes, i.invoiceNo, i.createdAt AS expenseDate, c.name AS clientName,
                $descriptionExpr AS procedureName
            FROM InvoiceProcedureCost pc
            JOIN Invoice i ON i.id = pc.invoiceId AND i.clinicId = pc.clinicId
            JOIN Client c ON c.id = pc.clientId AND c.clinicId = pc.clinicId
            LEFT JOIN Service s ON s.id = pc.serviceId AND s.clinicId = pc.clinicId
            WHERE $where
            ORDER BY i.createdAt DESC, pc.invoiceItemIndex ASC
            LIMIT $limit OFFSET $offset");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['patientCharge'] = floatval($row['patientCharge'] ?? 0);
            $row['procedureCost'] = floatval($row['procedureCost'] ?? 0);
        }
        unset($row);

        send_json([
            'expenses' => $rows,
            'totalAmount' => floatval($totals[1] ?? 0),
            'totalRecords' => $total,
            'page' => $page,
            'pages' => max(1, (int)ceil($total / $limit)),
            'limit' => $limit,
        ]);
    }

    public function getProcedureCosts($input, $user, $invoiceId) {
        $db = $this->ensure($user);
        $invoice = $this->invoice($db, $user['clinicId'], $invoiceId);
        $items = json_decode($invoice['items'], true) ?: [];

        $stmt = $db->prepare("SELECT * FROM InvoiceProcedureCost WHERE clinicId = ? AND invoiceId = ? ORDER BY invoiceItemIndex ASC");
        $stmt->execute([$user['clinicId'], $invoiceId]);
        $costs = [];
        foreach ($stmt->fetchAll() as $row) {
            $costs[intval($row['invoiceItemIndex'])] = $row;
        }

        $serviceDefaults = [];
        $stmtServices = $db->prepare("SELECT id, defaultProcedureCost FROM Service WHERE clinicId = ? AND defaultProcedureCost IS NOT NULL");
        $stmtServices->execute([$user['clinicId']]);
        foreach ($stmtServices->fetchAll() as $svc) {
            $serviceDefaults[$svc['id']] = floatval($svc['defaultProcedureCost']);
        }

        $rows = [];
        foreach ($items as $idx => $item) {
            $charge = floatval($item['qty'] ?? 1) * floatval($item['unitPrice'] ?? $item['price'] ?? 0);
            $row = $costs[$idx] ?? null;
            $serviceId = $row['serviceId'] ?? ($item['serviceId'] ?? null);
            $procedureCost = floatval($row['procedureCost'] ?? ($serviceId && isset($serviceDefaults[$serviceId]) ? $serviceDefaults[$serviceId] : 0));
            $rows[] = [
                'invoiceItemIndex' => $idx,
                'description' => $item['description'] ?? $item['name'] ?? 'Invoice item',
                'patientCharge' => floatval($row['patientCharge'] ?? $charge),
                'procedureCost' => $procedureCost,
                'netProfit' => floatval($row['patientCharge'] ?? $charge) - $procedureCost,
                'notes' => $row['notes'] ?? '',
                'serviceId' => $serviceId,
            ];
        }
        send_json(['invoiceId' => $invoiceId, 'items' => $rows]);
    }

    public function saveProcedureCost($input, $user, $invoiceId) {
        $db = $this->ensure($user);
        if (!pf_can_manage_procedure_costs($user)) send_error('Insufficient permissions', 403);
        $invoice = $this->invoice($db, $user['clinicId'], $invoiceId);
        $items = json_decode($invoice['items'], true) ?: [];
        $idx = intval($input['invoiceItemIndex'] ?? 0);
        if ($idx < 0 || $idx >= count($items)) send_error('Invoice item not found', 400);

        $item = $items[$idx];
        $charge = array_key_exists('patientCharge', $input)
            ? floatval($input['patientCharge'])
            : floatval($item['qty'] ?? 1) * floatval($item['unitPrice'] ?? $item['price'] ?? 0);
        $cost = floatval($input['procedureCost'] ?? 0);
        if ($charge < 0 || $cost < 0) send_error('Charges and costs cannot be negative', 400);

        $stmtExisting = $db->prepare("SELECT id FROM InvoiceProcedureCost WHERE clinicId = ? AND invoiceId = ? AND invoiceItemIndex = ?");
        $stmtExisting->execute([$user['clinicId'], $invoiceId, $idx]);
        $existingId = $stmtExisting->fetchColumn();
        $notes = trim((string)($input['notes'] ?? '')) ?: null;
        $serviceId = trim((string)($input['serviceId'] ?? ($item['serviceId'] ?? ''))) ?: null;
        if ($serviceId) {
            $stmtSvc = $db->prepare("SELECT id FROM Service WHERE id = ? AND clinicId = ?");
            $stmtSvc->execute([$serviceId, $user['clinicId']]);
            if (!$stmtSvc->fetch()) $serviceId = null;
        }

        if ($existingId) {
            $stmt = $db->prepare("UPDATE InvoiceProcedureCost SET patientCharge = ?, procedureCost = ?, notes = ?, serviceId = ?, updatedBy = ? WHERE id = ? AND clinicId = ?");
            $stmt->execute([$charge, $cost, $notes, $serviceId, $user['id'] ?? null, $existingId, $user['clinicId']]);
            $id = $existingId;
        } else {
            $id = generate_uuid();
            $stmt = $db->prepare("INSERT INTO InvoiceProcedureCost (id, clinicId, invoiceId, invoiceItemIndex, appointmentId, clientId, serviceId, patientCharge, procedureCost, notes, createdBy, updatedBy)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $id, $user['clinicId'], $invoiceId, $idx, $invoice['appointmentId'], $invoice['clientId'],
                $serviceId, $charge, $cost, $notes, $user['id'] ?? null, $user['id'] ?? null
            ]);
        }
        log_audit($user['clinicId'], $user['id'] ?? null, 'procedure_cost_saved', 'InvoiceProcedureCost', $id, null, ['invoiceId' => $invoiceId, 'cost' => $cost]);
        $this->getProcedureCosts($input, $user, $invoiceId);
    }

    public function getProfitability($input, $user) {
        $db = $this->ensure($user);
        $stmt = $db->prepare("SELECT
                COALESCE(s.name, JSON_UNQUOTE(JSON_EXTRACT(i.items, CONCAT('$[', pc.invoiceItemIndex, '].description'))), 'Invoice item') AS procedureName,
                COUNT(*) AS cases,
                COALESCE(SUM(pc.patientCharge), 0) AS revenue,
                COALESCE(SUM(pc.procedureCost), 0) AS procedureCost
            FROM InvoiceProcedureCost pc
            JOIN Invoice i ON i.id = pc.invoiceId AND i.clinicId = pc.clinicId
            LEFT JOIN Service s ON s.id = pc.serviceId AND s.clinicId = pc.clinicId
            WHERE pc.clinicId = ? AND i.status NOT IN ('refunded', 'cancelled')
            GROUP BY procedureName
            ORDER BY (COALESCE(SUM(pc.patientCharge), 0) - COALESCE(SUM(pc.procedureCost), 0)) DESC
            LIMIT 25");
        if (DB_DRIVER === 'sqlite') {
            $stmt = $db->prepare("SELECT COALESCE(s.name, 'Invoice item') AS procedureName,
                    COUNT(*) AS cases, COALESCE(SUM(pc.patientCharge), 0) AS revenue,
                    COALESCE(SUM(pc.procedureCost), 0) AS procedureCost
                FROM InvoiceProcedureCost pc
                JOIN Invoice i ON i.id = pc.invoiceId AND i.clinicId = pc.clinicId
                LEFT JOIN Service s ON s.id = pc.serviceId AND s.clinicId = pc.clinicId
                WHERE pc.clinicId = ? AND i.status NOT IN ('refunded', 'cancelled')
                GROUP BY procedureName
                ORDER BY (COALESCE(SUM(pc.patientCharge), 0) - COALESCE(SUM(pc.procedureCost), 0)) DESC
                LIMIT 25");
        }
        $stmt->execute([$user['clinicId']]);
        $rows = [];
        foreach ($stmt->fetchAll() as $row) {
            $revenue = floatval($row['revenue']);
            $cost = floatval($row['procedureCost']);
            $rows[] = [
                'procedureName' => $row['procedureName'],
                'cases' => intval($row['cases']),
                'revenue' => $revenue,
                'procedureCost' => $cost,
                'grossProfit' => $revenue - $cost,
                'margin' => $revenue > 0 ? round((($revenue - $cost) / $revenue) * 100, 1) : 0,
            ];
        }
        send_json($rows);
    }

    private function invoice($db, $clinicId, $invoiceId) {
        $stmt = $db->prepare("SELECT * FROM Invoice WHERE id = ? AND clinicId = ?");
        $stmt->execute([$invoiceId, $clinicId]);
        $invoice = $stmt->fetch();
        if (!$invoice) send_error('Invoice not found', 404);
        return $invoice;
    }
}
