<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../services/dentalFinancialService.php';

class ExpenseController {
    private function db($user) {
        if (!pf_can_manage_expenses($user)) send_error('Insufficient permissions', 403);
        $db = DB::getConnection();
        pf_dental_financials_ensure($db);
        pf_seed_expense_categories($db, $user['clinicId']);
        return $db;
    }

    private function assertBranch($db, $clinicId, $branchId) {
        if (!$branchId) return null;
        $stmt = $db->prepare("SELECT id FROM Branch WHERE id = ? AND clinicId = ?");
        $stmt->execute([$branchId, $clinicId]);
        if (!$stmt->fetch()) send_error('Branch not found', 400);
        return $branchId;
    }

    private function assertCategory($db, $clinicId, $categoryId) {
        if (!$categoryId) return null;
        $stmt = $db->prepare("SELECT id FROM ExpenseCategory WHERE id = ? AND clinicId = ? AND isActive = 1");
        $stmt->execute([$categoryId, $clinicId]);
        if (!$stmt->fetch()) send_error('Expense category not found', 400);
        return $categoryId;
    }

    private function saveReceipt($user, $current = null) {
        if (!isset($_FILES['receipt']) || $_FILES['receipt']['error'] === UPLOAD_ERR_NO_FILE) {
            return $current;
        }
        if ($_FILES['receipt']['error'] !== UPLOAD_ERR_OK) {
            send_error('Receipt upload failed', 400);
        }

        $file = $_FILES['receipt'];
        $allowed = [
            'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp',
            'application/pdf' => 'pdf',
        ];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        if (!isset($allowed[$mime])) {
            send_error('Receipt must be a JPG, PNG, WEBP, or PDF file', 400);
        }
        if ($file['size'] > 10 * 1024 * 1024) {
            send_error('Receipt must be under 10 MB', 400);
        }

        $clinicId = $user['clinicId'];
        $dir = UPLOAD_DIR . $clinicId . '/expenses/';
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        $filename = time() . '-' . bin2hex(random_bytes(6)) . '.' . $allowed[$mime];
        if (!move_uploaded_file($file['tmp_name'], $dir . $filename)) {
            send_error('Failed to save receipt', 500);
        }
        return "/uploads/$clinicId/expenses/$filename";
    }

    public function categories($input, $user) {
        $db = $this->db($user);
        $stmt = $db->prepare("SELECT * FROM ExpenseCategory WHERE clinicId = ? AND isActive = 1 ORDER BY name ASC");
        $stmt->execute([$user['clinicId']]);
        send_json($stmt->fetchAll());
    }

    public function createCategory($input, $user) {
        $db = $this->db($user);
        $name = trim((string)($input['name'] ?? ''));
        if ($name === '') send_error('Category name is required', 400);
        if (strlen($name) > 120) send_error('Category name is too long', 400);
        $id = generate_uuid();
        try {
            $stmt = $db->prepare("INSERT INTO ExpenseCategory (id, clinicId, name, type, isActive) VALUES (?, ?, ?, 'general', 1)");
            $stmt->execute([$id, $user['clinicId'], $name]);
        } catch (Exception $e) {
            send_error('Category already exists', 409);
        }
        $stmt = $db->prepare("SELECT * FROM ExpenseCategory WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        send_json($stmt->fetch(), 201);
    }

    // Rename a category (tenant-scoped).
    public function updateCategory($input, $user, $id) {
        $db = $this->db($user);
        $name = trim((string)($input['name'] ?? ''));
        if ($name === '') send_error('Category name is required', 400);
        if (strlen($name) > 120) send_error('Category name is too long', 400);

        $stmt = $db->prepare("SELECT id FROM ExpenseCategory WHERE id = ? AND clinicId = ? AND isActive = 1");
        $stmt->execute([$id, $user['clinicId']]);
        if (!$stmt->fetch()) send_error('Category not found', 404);

        try {
            $stmt = $db->prepare("UPDATE ExpenseCategory SET name = ? WHERE id = ? AND clinicId = ?");
            $stmt->execute([$name, $id, $user['clinicId']]);
        } catch (Exception $e) {
            send_error('Another category already has that name', 409);
        }
        $stmt = $db->prepare("SELECT * FROM ExpenseCategory WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        send_json($stmt->fetch());
    }

    // Soft-delete a category. Existing expenses keep their categoryId (their
    // record is preserved); the category just stops appearing in the picker.
    public function removeCategory($input, $user, $id) {
        $db = $this->db($user);
        $stmt = $db->prepare("SELECT id FROM ExpenseCategory WHERE id = ? AND clinicId = ? AND isActive = 1");
        $stmt->execute([$id, $user['clinicId']]);
        if (!$stmt->fetch()) send_error('Category not found', 404);

        $stmt = $db->prepare("UPDATE ExpenseCategory SET isActive = 0 WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        send_json(['message' => 'Category removed']);
    }

    public function list($input, $user) {
        $db = $this->db($user);
        $from = $_GET['from'] ?? date('Y-m-01');
        $to = $_GET['to'] ?? date('Y-m-t');
        $categoryId = $_GET['categoryId'] ?? '';
        $branchId = $_GET['branchId'] ?? '';
        $paginated = ($_GET['paginated'] ?? '') === 'true' || isset($_GET['page']) || isset($_GET['limit']);
        $page = max(1, intval($_GET['page'] ?? 1));
        $limit = min(100, max(1, intval($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        if (!pf_valid_date($from) || !pf_valid_date($to) || $from > $to) send_error('Invalid date range', 400);

        $where = ["e.clinicId = ?", "e.archivedAt IS NULL", "e.expenseDate >= ?", "e.expenseDate <= ?"];
        $params = [$user['clinicId'], $from, $to];
        if ($categoryId) { $where[] = "e.categoryId = ?"; $params[] = $categoryId; }
        if ($branchId) { $where[] = "e.branchId = ?"; $params[] = $branchId; }

        $whereSql = implode(' AND ', $where);
        $stmtTotals = $db->prepare("SELECT COUNT(*), COALESCE(SUM(e.amount), 0) FROM Expense e WHERE $whereSql");
        $stmtTotals->execute($params);
        $totals = $stmtTotals->fetch(PDO::FETCH_NUM) ?: [0, 0];
        $totalRecords = intval($totals[0]);
        $totalAmount = floatval($totals[1]);

        $sql = "SELECT e.*, ec.name AS categoryName, b.name AS branchName, u.name AS createdByName
            FROM Expense e
            LEFT JOIN ExpenseCategory ec ON ec.id = e.categoryId AND ec.clinicId = e.clinicId
            LEFT JOIN Branch b ON b.id = e.branchId AND b.clinicId = e.clinicId
            LEFT JOIN User u ON u.id = e.createdBy AND u.clinicId = e.clinicId
            WHERE $whereSql
            ORDER BY e.expenseDate DESC, e.createdAt DESC";
        if ($paginated) $sql .= " LIMIT $limit OFFSET $offset";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['amount'] = floatval($row['amount'] ?? 0);
            $row['receiptUrl'] = pf_uploads_url_to_signed($row['receiptUrl'] ?? null);
        }
        unset($row);
        send_json([
            'expenses' => $rows,
            'total' => $totalAmount,
            'totalAmount' => $totalAmount,
            'totalRecords' => $totalRecords,
            'page' => $page,
            'pages' => max(1, (int)ceil($totalRecords / $limit)),
            'limit' => $limit,
        ]);
    }

    public function create($input, $user) {
        $db = $this->db($user);
        $description = trim((string)($input['description'] ?? ''));
        $amount = floatval($input['amount'] ?? 0);
        $expenseDate = $input['expenseDate'] ?? date('Y-m-d');
        if ($description === '') send_error('Description is required', 400);
        if ($amount <= 0) send_error('Amount must be greater than zero', 400);
        if (!pf_valid_date($expenseDate)) send_error('Expense date is invalid', 400);

        $branchId = $this->assertBranch($db, $user['clinicId'], $input['branchId'] ?? null);
        $categoryId = $this->assertCategory($db, $user['clinicId'], $input['categoryId'] ?? null);
        $receiptUrl = $this->saveReceipt($user);
        $id = generate_uuid();

        $stmt = $db->prepare("INSERT INTO Expense (id, clinicId, branchId, categoryId, description, amount, expenseDate, paymentMethod, receiptUrl, createdBy)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $id, $user['clinicId'], $branchId, $categoryId, $description, $amount, $expenseDate,
            trim((string)($input['paymentMethod'] ?? '')) ?: null, $receiptUrl, $user['id'] ?? null
        ]);
        log_audit($user['clinicId'], $user['id'] ?? null, 'expense_created', 'Expense', $id, null, ['amount' => $amount]);
        $this->get($input, $user, $id);
    }

    public function update($input, $user, $id) {
        $db = $this->db($user);
        $stmt = $db->prepare("SELECT * FROM Expense WHERE id = ? AND clinicId = ? AND archivedAt IS NULL");
        $stmt->execute([$id, $user['clinicId']]);
        $existing = $stmt->fetch();
        if (!$existing) send_error('Expense not found', 404);

        $description = array_key_exists('description', $input) ? trim((string)$input['description']) : $existing['description'];
        $amount = array_key_exists('amount', $input) ? floatval($input['amount']) : floatval($existing['amount']);
        $expenseDate = $input['expenseDate'] ?? $existing['expenseDate'];
        if ($description === '') send_error('Description is required', 400);
        if ($amount <= 0) send_error('Amount must be greater than zero', 400);
        if (!pf_valid_date($expenseDate)) send_error('Expense date is invalid', 400);

        $branchId = array_key_exists('branchId', $input) ? $this->assertBranch($db, $user['clinicId'], $input['branchId'] ?: null) : $existing['branchId'];
        $categoryId = array_key_exists('categoryId', $input) ? $this->assertCategory($db, $user['clinicId'], $input['categoryId'] ?: null) : $existing['categoryId'];
        $receiptUrl = $this->saveReceipt($user, $existing['receiptUrl']);

        $stmt = $db->prepare("UPDATE Expense SET branchId = ?, categoryId = ?, description = ?, amount = ?, expenseDate = ?, paymentMethod = ?, receiptUrl = ? WHERE id = ? AND clinicId = ?");
        $stmt->execute([
            $branchId, $categoryId, $description, $amount, $expenseDate,
            array_key_exists('paymentMethod', $input) ? (trim((string)$input['paymentMethod']) ?: null) : $existing['paymentMethod'],
            $receiptUrl, $id, $user['clinicId']
        ]);
        log_audit($user['clinicId'], $user['id'] ?? null, 'expense_updated', 'Expense', $id, $existing, ['amount' => $amount]);
        $this->get($input, $user, $id);
    }

    public function get($input, $user, $id) {
        $db = $this->db($user);
        $stmt = $db->prepare("SELECT e.*, ec.name AS categoryName, b.name AS branchName, u.name AS createdByName
            FROM Expense e
            LEFT JOIN ExpenseCategory ec ON ec.id = e.categoryId AND ec.clinicId = e.clinicId
            LEFT JOIN Branch b ON b.id = e.branchId AND b.clinicId = e.clinicId
            LEFT JOIN User u ON u.id = e.createdBy AND u.clinicId = e.clinicId
            WHERE e.id = ? AND e.clinicId = ? AND e.archivedAt IS NULL");
        $stmt->execute([$id, $user['clinicId']]);
        $row = $stmt->fetch();
        if (!$row) send_error('Expense not found', 404);
        $row['amount'] = floatval($row['amount'] ?? 0);
        $row['receiptUrl'] = pf_uploads_url_to_signed($row['receiptUrl'] ?? null);
        send_json($row);
    }

    public function remove($input, $user, $id) {
        $db = $this->db($user);
        $stmt = $db->prepare("UPDATE Expense SET archivedAt = CURRENT_TIMESTAMP WHERE id = ? AND clinicId = ? AND archivedAt IS NULL");
        $stmt->execute([$id, $user['clinicId']]);
        if ($stmt->rowCount() < 1) send_error('Expense not found', 404);
        log_audit($user['clinicId'], $user['id'] ?? null, 'expense_archived', 'Expense', $id);
        send_json(['message' => 'Expense archived']);
    }
}
