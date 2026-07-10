<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../services/dentalFinancialService.php';
require_once __DIR__ . '/../services/clinicalSafetyPolicyService.php';

// Structured treatment plan: one row per planned procedure for a patient
// (procedure, tooth, cost, status). Kept flat for simplicity.
class TreatmentController {
    private function enforceClinicalWrite($db, $clinicId) {
        pf_enforce_clinical_capability($db, $clinicId, 'treatmentProcedureEntryEnabled', 'Treatment and procedure entry is read-only until PatientFlow has a governed clinical record model.');
    }

    private function ensureTable($db) {
        $sql = DB_DRIVER === 'sqlite'
            ? "CREATE TABLE IF NOT EXISTS TreatmentPlanItem (
                 id TEXT PRIMARY KEY, clinicId TEXT NOT NULL, clientId TEXT NOT NULL,
                 procedure TEXT NOT NULL, tooth TEXT, cost REAL DEFAULT 0,
                 status TEXT DEFAULT 'planned', notes TEXT, sortOrder INTEGER DEFAULT 0,
                 createdAt TEXT DEFAULT CURRENT_TIMESTAMP)"
            : "CREATE TABLE IF NOT EXISTS TreatmentPlanItem (
                 id VARCHAR(36) PRIMARY KEY, clinicId VARCHAR(36) NOT NULL, clientId VARCHAR(36) NOT NULL,
                 `procedure` VARCHAR(255) NOT NULL, tooth VARCHAR(50), cost DOUBLE DEFAULT 0,
                 status VARCHAR(30) DEFAULT 'planned', notes TEXT, sortOrder INT DEFAULT 0,
                 createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                 INDEX tp_client (clinicId, clientId)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $db->exec($sql);
    }

    private $statuses = ['planned', 'in_progress', 'completed', 'cancelled', 'archived'];
    private function col() { return DB_DRIVER === 'sqlite' ? 'procedure' : '`procedure`'; }

    private function assertClient($db, $clientId, $clinicId) {
        $stmt = $db->prepare("SELECT id FROM Client WHERE id = ? AND clinicId = ?");
        $stmt->execute([$clientId, $clinicId]);
        if (!$stmt->fetch()) send_error('Patient not found', 404);
    }

    private function ensureDental($db) {
        pf_dental_financials_ensure($db);
    }

    private function assertEntity($db, $table, $id, $clinicId, $clientId = null) {
        if (!$id) return null;
        $allowed = ['Appointment', 'Invoice', 'Service', 'Staff'];
        if (!in_array($table, $allowed, true)) return null;
        $sql = "SELECT id FROM $table WHERE id = ? AND clinicId = ?";
        $params = [$id, $clinicId];
        if ($clientId && in_array($table, ['Appointment', 'Invoice'], true)) {
            $sql .= " AND clientId = ?";
            $params[] = $clientId;
        }
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        if (!$stmt->fetch()) send_error("$table not found", 400);
        return $id;
    }

    public function list($input, $user, $clientId) {
        $db = DB::getConnection();
        $this->ensureTable($db);
        $this->assertClient($db, $clientId, $user['clinicId']);
        $stmt = $db->prepare("SELECT * FROM TreatmentPlanItem WHERE clinicId = ? AND clientId = ? AND status <> 'archived' ORDER BY sortOrder ASC, createdAt ASC");
        $stmt->execute([$user['clinicId'], $clientId]);
        send_json($stmt->fetchAll());
    }

    public function create($input, $user, $clientId) {
        $db = DB::getConnection();
        $this->enforceClinicalWrite($db, $user['clinicId']);
        $this->ensureTable($db);
        $this->assertClient($db, $clientId, $user['clinicId']);
        $procedure = trim((string)($input['procedure'] ?? ''));
        if ($procedure === '') send_error('Procedure is required', 400);
        $status = $input['status'] ?? 'planned';
        if (!in_array($status, $this->statuses, true)) $status = 'planned';
        $id = generate_uuid();
        $pc = $this->col();
        $db->prepare("INSERT INTO TreatmentPlanItem (id, clinicId, clientId, $pc, tooth, cost, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
           ->execute([$id, $user['clinicId'], $clientId, $procedure, trim((string)($input['tooth'] ?? '')) ?: null,
                      floatval($input['cost'] ?? 0), $status, trim((string)($input['notes'] ?? '')) ?: null]);
        log_audit($user['clinicId'], $user['id'] ?? null, 'treatment_plan_added', 'TreatmentPlanItem', $id, null, ['procedure' => $procedure]);
        $stmt = $db->prepare("SELECT * FROM TreatmentPlanItem WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        send_json($stmt->fetch(), 201);
    }

    public function update($input, $user, $id) {
        $db = DB::getConnection();
        $this->enforceClinicalWrite($db, $user['clinicId']);
        $this->ensureTable($db);
        $stmt = $db->prepare("SELECT id FROM TreatmentPlanItem WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        if (!$stmt->fetch()) send_error('Treatment item not found', 404);

        $fields = []; $params = [];
        if (isset($input['procedure']) && trim($input['procedure']) !== '') { $fields[] = $this->col() . " = ?"; $params[] = trim($input['procedure']); }
        if (array_key_exists('tooth', $input)) { $fields[] = "tooth = ?"; $params[] = trim((string)$input['tooth']) ?: null; }
        if (isset($input['cost'])) { $fields[] = "cost = ?"; $params[] = floatval($input['cost']); }
        if (isset($input['status']) && in_array($input['status'], $this->statuses, true)) { $fields[] = "status = ?"; $params[] = $input['status']; }
        if (array_key_exists('notes', $input)) { $fields[] = "notes = ?"; $params[] = trim((string)$input['notes']) ?: null; }
        if (!$fields) send_error('No fields to update', 400);
        $params[] = $id; $params[] = $user['clinicId'];
        $db->prepare("UPDATE TreatmentPlanItem SET " . implode(', ', $fields) . " WHERE id = ? AND clinicId = ?")->execute($params);
        $stmt = $db->prepare("SELECT * FROM TreatmentPlanItem WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        send_json($stmt->fetch());
    }

    public function remove($input, $user, $id) {
        $db = DB::getConnection();
        $this->enforceClinicalWrite($db, $user['clinicId']);
        $this->ensureTable($db);
        $stmt = $db->prepare("UPDATE TreatmentPlanItem SET status = 'archived' WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        send_json(['message' => 'Archived']);
    }

    public function details($input, $user, $clientId) {
        $db = DB::getConnection();
        $this->ensureDental($db);
        $this->assertClient($db, $clientId, $user['clinicId']);
        $stmt = $db->prepare("SELECT td.*, s.name AS serviceName, st.name AS staffName, i.invoiceNo
            FROM TreatmentProcedureDetail td
            LEFT JOIN Service s ON s.id = td.serviceId AND s.clinicId = td.clinicId
            LEFT JOIN Staff st ON st.id = td.staffId AND st.clinicId = td.clinicId
            LEFT JOIN Invoice i ON i.id = td.invoiceId AND i.clinicId = td.clinicId
            WHERE td.clinicId = ? AND td.clientId = ? AND td.archivedAt IS NULL
            ORDER BY td.performedAt DESC, td.createdAt DESC");
        $stmt->execute([$user['clinicId'], $clientId]);
        $rows = $stmt->fetchAll();
        $canSeeCost = pf_can_manage_procedure_costs($user);
        if (!$canSeeCost) {
            foreach ($rows as &$row) { unset($row['cost']); }
            unset($row);
        }
        send_json(['items' => $rows, 'canManageCost' => $canSeeCost]);
    }

    public function createDetail($input, $user, $clientId) {
        $db = DB::getConnection();
        $this->enforceClinicalWrite($db, $user['clinicId']);
        $this->ensureDental($db);
        $this->assertClient($db, $clientId, $user['clinicId']);

        $procedureType = trim((string)($input['procedureType'] ?? $input['procedure'] ?? ''));
        if ($procedureType === '') send_error('Procedure type is required', 400);
        $performedAt = trim((string)($input['performedAt'] ?? ''));
        if ($performedAt === '') $performedAt = date('Y-m-d H:i:s');
        if (strlen($performedAt) === 10 && pf_valid_date($performedAt)) $performedAt .= ' 00:00:00';

        $appointmentId = $this->assertEntity($db, 'Appointment', trim((string)($input['appointmentId'] ?? '')) ?: null, $user['clinicId'], $clientId);
        $invoiceId = $this->assertEntity($db, 'Invoice', trim((string)($input['invoiceId'] ?? '')) ?: null, $user['clinicId'], $clientId);
        $serviceId = $this->assertEntity($db, 'Service', trim((string)($input['serviceId'] ?? '')) ?: null, $user['clinicId']);
        $staffId = $this->assertEntity($db, 'Staff', trim((string)($input['staffId'] ?? '')) ?: null, $user['clinicId']);
        if ($appointmentId && (!$serviceId || !$staffId)) {
            $stmtAppt = $db->prepare("SELECT serviceId, staffId FROM Appointment WHERE id = ? AND clinicId = ? AND clientId = ?");
            $stmtAppt->execute([$appointmentId, $user['clinicId'], $clientId]);
            $appt = $stmtAppt->fetch();
            if ($appt) {
                if (!$serviceId) $serviceId = $appt['serviceId'] ?: null;
                if (!$staffId) $staffId = $appt['staffId'] ?: null;
            }
        }
        if (!$staffId && !empty($user['staffId'])) $staffId = $this->assertEntity($db, 'Staff', $user['staffId'], $user['clinicId']);

        $statusAllowed = ['planned', 'in_progress', 'completed'];
        $status = in_array($input['status'] ?? '', $statusAllowed, true) ? $input['status'] : 'completed';

        $cost = pf_can_manage_procedure_costs($user) ? max(0, floatval($input['cost'] ?? 0)) : 0;

        $id = generate_uuid();
        $stmt = $db->prepare("INSERT INTO TreatmentProcedureDetail
            (id, clinicId, clientId, appointmentId, invoiceId, serviceId, staffId, procedureType, toothNumber, jaw, side, canalType, extractionType, crownMaterial, notes, followUpDate, performedAt, status, cost, createdBy)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $id, $user['clinicId'], $clientId, $appointmentId, $invoiceId, $serviceId, $staffId, $procedureType,
            trim((string)($input['toothNumber'] ?? $input['tooth'] ?? '')) ?: null,
            trim((string)($input['jaw'] ?? '')) ?: null,
            trim((string)($input['side'] ?? '')) ?: null,
            trim((string)($input['canalType'] ?? '')) ?: null,
            trim((string)($input['extractionType'] ?? '')) ?: null,
            trim((string)($input['crownMaterial'] ?? '')) ?: null,
            trim((string)($input['notes'] ?? '')) ?: null,
            pf_valid_date($input['followUpDate'] ?? '') ? $input['followUpDate'] : null,
            $performedAt,
            $status,
            $cost,
            $user['id'] ?? null
        ]);
        log_audit($user['clinicId'], $user['id'] ?? null, 'treatment_detail_created', 'TreatmentProcedureDetail', $id, null, ['procedureType' => $procedureType]);
        $this->details($input, $user, $clientId);
    }

    public function updateDetail($input, $user, $id) {
        $db = DB::getConnection();
        $this->enforceClinicalWrite($db, $user['clinicId']);
        $this->ensureDental($db);
        $stmt = $db->prepare("SELECT * FROM TreatmentProcedureDetail WHERE id = ? AND clinicId = ? AND archivedAt IS NULL");
        $stmt->execute([$id, $user['clinicId']]);
        $existing = $stmt->fetch();
        if (!$existing) send_error('Treatment detail not found', 404);

        $fields = []; $params = [];
        $updatable = ['procedureType', 'toothNumber', 'jaw', 'side', 'canalType', 'extractionType', 'crownMaterial', 'notes', 'followUpDate', 'performedAt'];
        foreach ($updatable as $key) {
            if (array_key_exists($key, $input)) {
                $value = trim((string)$input[$key]);
                if ($key === 'procedureType' && $value === '') send_error('Procedure type is required', 400);
                if ($key === 'followUpDate' && $value !== '' && !pf_valid_date($value)) send_error('Follow-up date is invalid', 400);
                if ($key === 'performedAt' && strlen($value) === 10 && pf_valid_date($value)) $value .= ' 00:00:00';
                $fields[] = "$key = ?";
                $params[] = $value === '' ? null : $value;
            }
        }
        if (array_key_exists('cost', $input) && pf_can_manage_procedure_costs($user)) {
            $fields[] = "cost = ?";
            $params[] = max(0, floatval($input['cost']));
        }
        if (!$fields) send_error('No fields to update', 400);
        $params[] = $id; $params[] = $user['clinicId'];
        $db->prepare("UPDATE TreatmentProcedureDetail SET " . implode(', ', $fields) . " WHERE id = ? AND clinicId = ?")->execute($params);
        log_audit($user['clinicId'], $user['id'] ?? null, 'treatment_detail_updated', 'TreatmentProcedureDetail', $id, $existing, null);
        send_json(['message' => 'Updated']);
    }

    public function removeDetail($input, $user, $id) {
        $db = DB::getConnection();
        $this->enforceClinicalWrite($db, $user['clinicId']);
        $this->ensureDental($db);
        $stmt = $db->prepare("UPDATE TreatmentProcedureDetail SET archivedAt = CURRENT_TIMESTAMP WHERE id = ? AND clinicId = ? AND archivedAt IS NULL");
        $stmt->execute([$id, $user['clinicId']]);
        if ($stmt->rowCount() < 1) send_error('Treatment detail not found', 404);
        log_audit($user['clinicId'], $user['id'] ?? null, 'treatment_detail_archived', 'TreatmentProcedureDetail', $id);
        send_json(['message' => 'Archived']);
    }

    public function timeline($input, $user, $clientId) {
        $db = DB::getConnection();
        $this->ensureDental($db);
        $this->assertClient($db, $clientId, $user['clinicId']);
        $canSeeAmounts = pf_can_view_business_financials($user) || pf_finance_role($user) === 'receptionist';
        $items = [];

        $stmtDetails = $db->prepare("SELECT td.*, s.name AS serviceName, st.name AS staffName, i.invoiceNo
            FROM TreatmentProcedureDetail td
            LEFT JOIN Service s ON s.id = td.serviceId AND s.clinicId = td.clinicId
            LEFT JOIN Staff st ON st.id = td.staffId AND st.clinicId = td.clinicId
            LEFT JOIN Invoice i ON i.id = td.invoiceId AND i.clinicId = td.clinicId
            WHERE td.clinicId = ? AND td.clientId = ? AND td.archivedAt IS NULL");
        $stmtDetails->execute([$user['clinicId'], $clientId]);
        foreach ($stmtDetails->fetchAll() as $row) {
            $items[] = [
                'id' => 'detail-' . $row['id'],
                'type' => 'procedure',
                'date' => substr($row['performedAt'], 0, 10),
                'treatmentDate' => $row['performedAt'],
                'procedure' => $row['procedureType'],
                'toothNumber' => $row['toothNumber'],
                'dentist' => $row['staffName'],
                'notes' => $row['notes'],
                'invoice' => $row['invoiceNo'],
                'followUp' => $row['followUpDate'],
                'details' => $row,
            ];
        }

        $stmtAppt = $db->prepare("SELECT a.*, s.name AS serviceName, st.name AS staffName
            FROM Appointment a
            LEFT JOIN Service s ON s.id = a.serviceId AND s.clinicId = a.clinicId
            LEFT JOIN Staff st ON st.id = a.staffId AND st.clinicId = a.clinicId
            WHERE a.clinicId = ? AND a.clientId = ?");
        $stmtAppt->execute([$user['clinicId'], $clientId]);
        foreach ($stmtAppt->fetchAll() as $row) {
            $items[] = [
                'id' => 'appointment-' . $row['id'],
                'type' => 'appointment',
                'date' => $row['date'],
                'treatmentDate' => trim($row['date'] . ' ' . $row['startTime']),
                'procedure' => $row['serviceName'] ?: 'Appointment',
                'toothNumber' => null,
                'dentist' => $row['staffName'],
                'notes' => $row['notes'],
                'invoice' => null,
                'followUp' => null,
                'status' => $row['status'],
            ];
        }

        $stmtInv = $db->prepare("SELECT invoiceNo, createdAt, status, grandTotal, amountPaid, balanceDue FROM Invoice WHERE clinicId = ? AND clientId = ?");
        $stmtInv->execute([$user['clinicId'], $clientId]);
        foreach ($stmtInv->fetchAll() as $row) {
            $entry = [
                'id' => 'invoice-' . $row['invoiceNo'],
                'type' => 'invoice',
                'date' => substr($row['createdAt'], 0, 10),
                'treatmentDate' => $row['createdAt'],
                'procedure' => 'Invoice',
                'toothNumber' => null,
                'dentist' => null,
                'notes' => $row['status'],
                'invoice' => $row['invoiceNo'],
                'followUp' => null,
            ];
            if ($canSeeAmounts) {
                $entry['grandTotal'] = floatval($row['grandTotal']);
                $entry['amountPaid'] = floatval($row['amountPaid']);
                $entry['balanceDue'] = floatval($row['balanceDue']);
            }
            $items[] = $entry;
        }

        usort($items, fn($a, $b) => strcmp($b['treatmentDate'] ?? '', $a['treatmentDate'] ?? ''));
        send_json($items);
    }
}
