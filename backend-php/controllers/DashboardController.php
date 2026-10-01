<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../services/dentalFinancialService.php';
require_once __DIR__ . '/../services/invoicePaymentService.php';

class DashboardController {
    private function dateRange() {
        $rawFrom = $_GET['from'] ?? date('Y-m-01');
        $rawTo = $_GET['to'] ?? date('Y-m-t');
        if (!pf_valid_date($rawFrom) || !pf_valid_date($rawTo) || $rawFrom > $rawTo) {
            send_error('Invalid dashboard date range', 400);
        }
        return [$rawFrom, $rawTo, $rawFrom . ' 00:00:00', $rawTo . ' 23:59:59'];
    }

    private function safeSum($db, $sql, $params) {
        try {
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            return floatval($stmt->fetchColumn() ?: 0);
        } catch (Exception $e) {
            return 0.0;
        }
    }

    private function safeRows($db, $sql, $params) {
        try {
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            return $stmt->fetchAll();
        } catch (Exception $e) {
            return [];
        }
    }

    private function rangeMeta($fromDate, $toDate, $financials) {
        $from = new DateTimeImmutable($fromDate);
        $to = new DateTimeImmutable($toDate);
        $today = new DateTimeImmutable(date('Y-m-d'));
        $rangeDays = max(1, $from->diff($to)->days + 1);
        $elapsedTo = $today < $to ? $today : $to;
        $elapsedDays = $today < $from ? 0 : max(1, $from->diff($elapsedTo)->days + 1);
        $dailyAverage = $elapsedDays > 0 ? floatval($financials['totalRevenue'] ?? 0) / $elapsedDays : 0.0;
        $projectedRevenue = $dailyAverage * $rangeDays;
        $targetProgress = $projectedRevenue > 0 ? min(100, round((floatval($financials['totalRevenue'] ?? 0) / $projectedRevenue) * 100)) : 0;

        return [
            'days' => $rangeDays,
            'elapsedDays' => $elapsedDays,
            'dailyAverage' => $dailyAverage,
            'projectedRevenue' => $projectedRevenue,
            'targetProgress' => $targetProgress,
        ];
    }

    private function financialSummary($db, $user, $fromDate, $toDate, $fromDateTime, $toDateTime) {
        if (!pf_can_view_business_financials($user)) return null;

        $clinicId = $user['clinicId'];
        $totalRevenue = $this->safeSum(
            $db,
            'SELECT COALESCE(SUM(amount), 0) FROM InvoicePaymentEntry WHERE clinicId = ? AND paidAt >= ? AND paidAt <= ?',
            [$clinicId, $fromDateTime, $toDateTime]
        );
        $outstandingPayments = $this->safeSum(
            $db,
            "SELECT COALESCE(SUM(balanceDue), 0) FROM Invoice WHERE clinicId = ? AND status IN ('pending', 'partial')",
            [$clinicId]
        );
        $generalExpenses = $this->safeSum(
            $db,
            'SELECT COALESCE(SUM(amount), 0) FROM Expense WHERE clinicId = ? AND archivedAt IS NULL AND expenseDate >= ? AND expenseDate <= ?',
            [$clinicId, $fromDate, $toDate]
        );
        $procedureCosts = $this->safeSum(
            $db,
            "SELECT COALESCE(SUM(pc.procedureCost), 0)
             FROM InvoiceProcedureCost pc
             JOIN Invoice i ON i.id = pc.invoiceId AND i.clinicId = pc.clinicId
             WHERE pc.clinicId = ? AND i.status NOT IN ('refunded', 'cancelled') AND i.createdAt >= ? AND i.createdAt <= ?",
            [$clinicId, $fromDateTime, $toDateTime]
        );
        $totalExpenses = $generalExpenses + $procedureCosts;

        return [
            'totalRevenue' => $totalRevenue,
            'totalExpenses' => $totalExpenses,
            'generalExpenses' => $generalExpenses,
            'procedureCosts' => $procedureCosts,
            'profit' => $totalRevenue - $totalExpenses,
            'outstandingPayments' => $outstandingPayments,
            'grossProfit' => $totalRevenue - $procedureCosts,
            'netProfit' => $totalRevenue - $totalExpenses,
        ];
    }

    private function doctorPerformance($db, $clinicId, $fromDateTime, $toDateTime) {
        $rows = $this->safeRows($db, "
            SELECT s.id, s.name, s.role, s.designation, s.compensationType, s.fixedSalary, s.commissionRate,
                   (SELECT COUNT(*)
                    FROM Appointment a
                    WHERE a.staffId = s.id AND a.clinicId = s.clinicId
                      AND a.date >= ? AND a.date <= ?
                      AND a.status NOT IN ('cancelled', 'no-show')) AS appointments,
                   (SELECT COALESCE(SUM(CASE WHEN p.type = 'payment' THEN p.amount ELSE 0 END), 0)
                    FROM InvoicePaymentEntry p
                    JOIN Invoice i ON i.id = p.invoiceId AND i.clinicId = p.clinicId
                    JOIN Appointment a ON a.id = i.appointmentId AND a.clinicId = i.clinicId
                    WHERE a.staffId = s.id AND p.clinicId = s.clinicId
                      AND p.paidAt >= ? AND p.paidAt <= ?) AS collected
            FROM Staff s
            WHERE s.clinicId = ? AND s.status = 'active'
            ORDER BY collected DESC, appointments DESC, s.name ASC
            LIMIT 5
        ", [substr($fromDateTime, 0, 10), substr($toDateTime, 0, 10), $fromDateTime, $toDateTime, $clinicId]);

        foreach ($rows as &$row) {
            $revenue = floatval($row['collected'] ?? 0);
            $fixedSalary = floatval($row['fixedSalary'] ?? 0);
            $commissionRate = floatval($row['commissionRate'] ?? 0);
            $type = strtolower((string)($row['compensationType'] ?? 'commission'));
            $commission = $commissionRate > 0 ? ($revenue * $commissionRate / 100) : 0.0;
            $payable = $commission;
            if (in_array($type, ['fixed', 'salary'], true)) {
                $payable = $fixedSalary;
            } elseif (in_array($type, ['fixed_plus_commission', 'salary_plus_commission', 'hybrid'], true)) {
                $payable = $fixedSalary + $commission;
            }

            $row['appointments'] = intval($row['appointments'] ?? 0);
            $row['revenue'] = $revenue;
            $row['commissionRate'] = $commissionRate;
            $row['payable'] = $payable;
            unset($row['collected']);
        }
        unset($row);

        return $rows;
    }

    private function pendingInvoices($db, $clinicId) {
        $rows = $this->safeRows($db, "
            SELECT i.id, i.invoiceNo, i.balanceDue, i.status, i.dueDate, i.createdAt, c.name AS clientName
            FROM Invoice i
            LEFT JOIN Client c ON c.id = i.clientId AND c.clinicId = i.clinicId
            WHERE i.clinicId = ? AND i.status IN ('pending', 'partial') AND i.balanceDue > 0
            ORDER BY
                CASE WHEN i.dueDate IS NULL OR i.dueDate = '' THEN 1 ELSE 0 END,
                i.dueDate ASC,
                i.createdAt ASC
            LIMIT 6
        ", [$clinicId]);

        $today = new DateTimeImmutable(date('Y-m-d'));
        foreach ($rows as &$row) {
            $row['balanceDue'] = floatval($row['balanceDue'] ?? 0);
            $basis = !empty($row['dueDate']) ? $row['dueDate'] : substr((string)$row['createdAt'], 0, 10);
            $due = pf_valid_date($basis) ? new DateTimeImmutable($basis) : $today;
            $row['ageDays'] = max(0, $due->diff($today)->invert ? 0 : $due->diff($today)->days);
        }
        unset($row);

        return $rows;
    }

    private function monthlyExpenseReminders($db, $clinicId) {
        $monthStart = date('Y-m-01');
        $monthEnd = date('Y-m-t');
        $today = date('Y-m-d');
        $daysInMonth = intval(date('t'));

        $scheduled = $this->safeRows($db, "
            SELECT r.*, ec.name AS categoryName
            FROM RecurringExpense r
            LEFT JOIN ExpenseCategory ec ON ec.id = r.categoryId AND ec.clinicId = r.clinicId
            WHERE r.clinicId = ? AND r.isActive = 1
            ORDER BY r.dueDay ASC, r.description ASC
            LIMIT 8
        ", [$clinicId]);

        $reminders = [];
        foreach ($scheduled as $row) {
            $dueDay = min(max(1, intval($row['dueDay'] ?? 1)), $daysInMonth);
            $dueDate = date('Y-m-') . str_pad((string)$dueDay, 2, '0', STR_PAD_LEFT);
            $params = [$clinicId, $monthStart, $monthEnd, $row['description']];
            $where = "clinicId = ? AND archivedAt IS NULL AND expenseDate >= ? AND expenseDate <= ? AND description = ?";
            if (!empty($row['categoryId'])) {
                $where .= " AND categoryId = ?";
                $params[] = $row['categoryId'];
            }
            $recorded = $this->safeRows($db, "SELECT id FROM Expense WHERE $where LIMIT 1", $params);
            $isRecorded = !empty($recorded) || (($row['lastPostedMonth'] ?? '') === substr($monthStart, 0, 7));
            $reminders[] = [
                'id' => $row['id'],
                'categoryId' => $row['categoryId'] ?: null,
                'categoryName' => $row['categoryName'] ?: 'Monthly expense',
                'description' => $row['description'],
                'estimatedAmount' => floatval($row['amount'] ?? 0),
                'dueDay' => $dueDay,
                'dueDate' => $dueDate,
                'isRecordedThisMonth' => $isRecorded,
                'isDue' => !$isRecorded && $dueDate <= $today,
                'source' => 'recurring',
            ];
        }

        if (!empty($reminders)) return $reminders;

        $previousStart = date('Y-m-01', strtotime('-3 months'));
        $keywords = ['rent', 'salary', 'salaries', 'electric', 'electricity', 'internet', 'marketing', 'lab', 'supply', 'supplies'];

        $rows = $this->safeRows($db, "
            SELECT COALESCE(ec.id, '') AS categoryId,
                   COALESCE(ec.name, 'General expense') AS categoryName,
                   MAX(e.description) AS description,
                   AVG(e.amount) AS averageAmount,
                   MAX(e.expenseDate) AS lastExpenseDate,
                   SUM(CASE WHEN e.expenseDate >= ? AND e.expenseDate <= ? THEN 1 ELSE 0 END) AS currentMonthEntries
            FROM Expense e
            LEFT JOIN ExpenseCategory ec ON ec.id = e.categoryId AND ec.clinicId = e.clinicId
            WHERE e.clinicId = ? AND e.archivedAt IS NULL AND e.expenseDate >= ?
            GROUP BY COALESCE(ec.id, ''), COALESCE(ec.name, 'General expense')
            ORDER BY averageAmount DESC
            LIMIT 12
        ", [$monthStart, $monthEnd, $clinicId, $previousStart]);

        foreach ($rows as $row) {
            if (intval($row['currentMonthEntries'] ?? 0) > 0) continue;
            $label = strtolower(($row['categoryName'] ?? '') . ' ' . ($row['description'] ?? ''));
            $looksMonthly = false;
            foreach ($keywords as $keyword) {
                if (strpos($label, $keyword) !== false) {
                    $looksMonthly = true;
                    break;
                }
            }
            if (!$looksMonthly && count($reminders) >= 3) continue;
            $reminders[] = [
                'categoryId' => $row['categoryId'] ?: null,
                'categoryName' => $row['categoryName'],
                'description' => $row['description'],
                'estimatedAmount' => floatval($row['averageAmount'] ?? 0),
                'lastExpenseDate' => $row['lastExpenseDate'],
                'source' => 'history',
            ];
            if (count($reminders) >= 5) break;
        }

        return $reminders;
    }

    public function summary($input, $user) {
        $db = DB::getConnection();
        $clinicId = $user['clinicId'];
        [$fromDate, $toDate, $fromDateTime, $toDateTime] = $this->dateRange();
        $today = date('Y-m-d');
        if (pf_can_view_business_financials($user)) {
            pf_dental_financials_ensure($db);
        }

        $stmt = $db->prepare("
            SELECT a.id, a.date, a.startTime, a.endTime, a.status,
                   c.name AS clientName,
                   s.name AS serviceName
            FROM Appointment a
            LEFT JOIN Client c ON c.id = a.clientId AND c.clinicId = a.clinicId
            LEFT JOIN Service s ON s.id = a.serviceId AND s.clinicId = a.clinicId
            WHERE a.clinicId = ? AND a.date = ?
            ORDER BY a.startTime ASC
            LIMIT 12
        ");
        $stmt->execute([$clinicId, $today]);
        $todayAppointments = $stmt->fetchAll();

        $stmt = $db->prepare('SELECT COUNT(*) FROM Appointment WHERE clinicId = ? AND date = ?');
        $stmt->execute([$clinicId, $today]);
        $todayAppointmentCount = intval($stmt->fetchColumn() ?: 0);

        $stmt = $db->prepare("SELECT COUNT(*) FROM Client WHERE clinicId = ? AND status != 'inactive'");
        $stmt->execute([$clinicId]);
        $activeClientCount = intval($stmt->fetchColumn() ?: 0);

        $stageCounts = null;
        try {
            $stmt = $db->prepare("SELECT workflowStage, COUNT(*) AS stageTotal FROM Client WHERE clinicId = ? AND status != 'inactive' GROUP BY workflowStage");
            $stmt->execute([$clinicId]);
            $stageCounts = [];
            foreach ($stmt->fetchAll() as $row) {
                $stageCounts[$row['workflowStage'] ?? ''] = intval($row['stageTotal']);
            }
        } catch (Exception $e) {
            $stageCounts = null;
        }

        $stmt = $db->prepare("SELECT COUNT(*) FROM Staff WHERE clinicId = ? AND status = 'active'");
        $stmt->execute([$clinicId]);
        $activeStaffCount = intval($stmt->fetchColumn() ?: 0);

        $stmt = $db->prepare("
            SELECT id, name, role, designation, status, rating
            FROM Staff
            WHERE clinicId = ? AND status = 'active'
            ORDER BY rating DESC, name ASC
            LIMIT 5
        ");
        $stmt->execute([$clinicId]);
        $topStaff = $stmt->fetchAll();
        foreach ($topStaff as &$member) {
            $member['rating'] = floatval($member['rating'] ?? 0);
        }
        unset($member);

        $stmt = $db->prepare('SELECT COUNT(*) FROM Service WHERE clinicId = ?');
        $stmt->execute([$clinicId]);
        $servicesCount = intval($stmt->fetchColumn() ?: 0);

        $stmt = $db->prepare("SELECT COUNT(*) FROM Invoice WHERE clinicId = ? AND status IN ('pending', 'partial')");
        $stmt->execute([$clinicId]);
        $pendingInvoiceCount = intval($stmt->fetchColumn() ?: 0);
        $financials = $this->financialSummary($db, $user, $fromDate, $toDate, $fromDateTime, $toDateTime);

        send_json([
            'range' => array_merge(['from' => $fromDate, 'to' => $toDate], $financials ? $this->rangeMeta($fromDate, $toDate, $financials) : []),
            'today' => $today,
            'appointments' => [
                'today' => $todayAppointments,
                'todayCount' => $todayAppointmentCount,
            ],
            'clients' => [
                'activeCount' => $activeClientCount,
                'stageCounts' => $stageCounts,
            ],
            'staff' => [
                'activeCount' => $activeStaffCount,
                'top' => $topStaff,
            ],
            'services' => [
                'count' => $servicesCount,
            ],
            'invoices' => [
                'pendingCount' => $pendingInvoiceCount,
                'pending' => $this->pendingInvoices($db, $clinicId),
            ],
            'financials' => $financials,
            'doctorPerformance' => $financials ? $this->doctorPerformance($db, $clinicId, $fromDateTime, $toDateTime) : [],
            'expenseReminders' => $financials ? $this->monthlyExpenseReminders($db, $clinicId) : [],
        ]);
    }
}
