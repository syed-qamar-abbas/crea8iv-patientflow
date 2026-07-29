<?php
require_once __DIR__ . '/../services/prescriptionPdfService.php';

class PrescriptionController {
    // Self-heals the Prescription table so a file-copy deploy works without a
    // manual migration step. Mirrors the ensure* pattern used elsewhere.
    private function ensureTable($db) {
        if (DB_DRIVER === 'sqlite') {
            $db->exec("CREATE TABLE IF NOT EXISTS Prescription (
                id TEXT PRIMARY KEY,
                clinicId TEXT NOT NULL,
                clientId TEXT NOT NULL,
                prescriptionNo TEXT,
                staffId TEXT,
                doctorName TEXT,
                doctorQualification TEXT,
                doctorRegNo TEXT,
                date TEXT,
                diagnosis TEXT,
                clinicalNotes TEXT,
                medicines TEXT,
                investigations TEXT,
                followUpDate TEXT,
                additionalNotes TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                createdBy TEXT,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )");
            $db->exec("CREATE INDEX IF NOT EXISTS IX_Prescription_Clinic_Client ON Prescription (clinicId, clientId)");
        } else {
            $db->exec("CREATE TABLE IF NOT EXISTS Prescription (
                id VARCHAR(36) NOT NULL,
                clinicId VARCHAR(36) NOT NULL,
                clientId VARCHAR(36) NOT NULL,
                prescriptionNo VARCHAR(50) DEFAULT NULL,
                staffId VARCHAR(36) DEFAULT NULL,
                doctorName VARCHAR(191) DEFAULT NULL,
                doctorQualification VARCHAR(255) DEFAULT NULL,
                doctorRegNo VARCHAR(100) DEFAULT NULL,
                date VARCHAR(50) DEFAULT NULL,
                diagnosis TEXT DEFAULT NULL,
                clinicalNotes TEXT DEFAULT NULL,
                medicines MEDIUMTEXT DEFAULT NULL,
                investigations TEXT DEFAULT NULL,
                followUpDate VARCHAR(50) DEFAULT NULL,
                additionalNotes TEXT DEFAULT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'active',
                createdBy VARCHAR(36) DEFAULT NULL,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY IX_Prescription_Clinic_Client (clinicId, clientId)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            // Older deploys may have created this table with the server's default
            // collation, which breaks the JOIN to Client (utf8mb4_unicode_ci) with
            // an "illegal mix of collations" error. Align it, idempotently.
            try {
                $col = $db->query("SELECT table_collation FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Prescription'")->fetchColumn();
                if ($col && $col !== 'utf8mb4_unicode_ci') {
                    $db->exec("ALTER TABLE Prescription CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                }
            } catch (Exception $e) { /* best-effort */ }
        }
    }

    private function generatePrescriptionNo($db, $clinicId) {
        $date = date('Ymd');
        $pattern = "RX-$date-%";
        $stmt = $db->prepare("SELECT COUNT(*) FROM Prescription WHERE clinicId = ? AND prescriptionNo LIKE ?");
        $stmt->execute([$clinicId, $pattern]);
        $seq = intval($stmt->fetchColumn()) + 1;
        return "RX-$date-" . str_pad($seq, 4, '0', STR_PAD_LEFT);
    }

    // Medicines are stored as a JSON array of rows; keep it bounded and shaped.
    private function normalizeMedicines($value) {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            $value = is_array($decoded) ? $decoded : [];
        }
        if (!is_array($value)) $value = [];
        $rows = [];
        foreach ($value as $m) {
            if (!is_array($m)) continue;
            $name = trim((string)($m['name'] ?? ''));
            if ($name === '') continue;
            $rows[] = [
                'name' => mb_substr($name, 0, 191),
                'dosage' => mb_substr(trim((string)($m['dosage'] ?? '')), 0, 100),
                'frequency' => mb_substr(trim((string)($m['frequency'] ?? '')), 0, 100),
                'duration' => mb_substr(trim((string)($m['duration'] ?? '')), 0, 100),
                'instructions' => mb_substr(trim((string)($m['instructions'] ?? '')), 0, 255),
            ];
            if (count($rows) >= 50) break;
        }
        return $rows;
    }

    private function decodeRow($row) {
        if (!$row) return $row;
        $row['medicines'] = json_decode($row['medicines'] ?? '[]', true) ?: [];
        return $row;
    }

    public function list($input, $user) {
        $db = DB::getConnection();
        $this->ensureTable($db);

        $where = ["p.clinicId = ?", "p.status != 'cancelled'"];
        $params = [$user['clinicId']];

        $clientId = $_GET['clientId'] ?? '';
        if (!empty($clientId)) { $where[] = "p.clientId = ?"; $params[] = $clientId; }

        $search = trim($_GET['search'] ?? '');
        if ($search !== '') {
            $where[] = "(c.name LIKE ? OR c.phone LIKE ? OR c.patientNo LIKE ? OR p.prescriptionNo LIKE ? OR p.diagnosis LIKE ?)";
            $like = "%$search%";
            array_push($params, $like, $like, $like, $like, $like);
        }
        $whereSql = implode(' AND ', $where);

        $limit = min(200, max(1, intval($_GET['limit'] ?? 100)));
        $sql = "SELECT p.*, c.name AS clientName, c.phone AS clientPhone, c.patientNo AS clientPatientNo,
                       c.dob AS clientDob, c.gender AS clientGender
                FROM Prescription p
                LEFT JOIN Client c ON p.clientId = c.id AND c.clinicId = p.clinicId
                WHERE $whereSql
                ORDER BY p.createdAt DESC
                LIMIT $limit";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = array_map([$this, 'decodeRow'], $stmt->fetchAll());
        send_json($rows);
    }

    public function create($input, $user) {
        $db = DB::getConnection();
        $this->ensureTable($db);

        $clientId = $input['clientId'] ?? '';
        if (empty($clientId)) send_error('clientId is required', 400);

        $stmt = $db->prepare("SELECT id FROM Client WHERE id = ? AND clinicId = ?");
        $stmt->execute([$clientId, $user['clinicId']]);
        if (!$stmt->fetch()) send_error('Client not found', 404);

        // Snapshot doctor details at creation so the record stays accurate even
        // if the staff profile changes later.
        $staffId = $input['staffId'] ?? null;
        $doctorName = trim((string)($input['doctorName'] ?? ''));
        $doctorQualification = trim((string)($input['doctorQualification'] ?? ''));
        $doctorRegNo = trim((string)($input['doctorRegNo'] ?? ''));
        if ($staffId) {
            $s = $db->prepare("SELECT name, qualifications FROM Staff WHERE id = ? AND clinicId = ?");
            $s->execute([$staffId, $user['clinicId']]);
            $staff = $s->fetch();
            if ($staff) {
                if ($doctorName === '') $doctorName = $staff['name'] ?? '';
                if ($doctorQualification === '') $doctorQualification = $staff['qualifications'] ?? '';
            } else {
                $staffId = null;
            }
        }

        $id = generate_uuid();
        $prescriptionNo = $this->generatePrescriptionNo($db, $user['clinicId']);
        $medicines = json_encode($this->normalizeMedicines($input['medicines'] ?? []));

        $stmt = $db->prepare("INSERT INTO Prescription
            (id, clinicId, clientId, prescriptionNo, staffId, doctorName, doctorQualification, doctorRegNo,
             date, diagnosis, clinicalNotes, medicines, investigations, followUpDate, additionalNotes, status, createdBy)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)");
        $stmt->execute([
            $id, $user['clinicId'], $clientId, $prescriptionNo, $staffId,
            $doctorName ?: null, $doctorQualification ?: null, $doctorRegNo ?: null,
            $input['date'] ?? date('Y-m-d'),
            trim((string)($input['diagnosis'] ?? '')) ?: null,
            trim((string)($input['clinicalNotes'] ?? '')) ?: null,
            $medicines,
            trim((string)($input['investigations'] ?? '')) ?: null,
            ($input['followUpDate'] ?? '') ?: null,
            trim((string)($input['additionalNotes'] ?? '')) ?: null,
            $user['id'] ?? null,
        ]);

        log_audit($user['clinicId'], $user['id'] ?? null, 'prescription_created', 'Prescription', $id, null, ['no' => $prescriptionNo]);

        $stmt = $db->prepare("SELECT * FROM Prescription WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        send_json($this->decodeRow($stmt->fetch()), 201);
    }

    public function getById($input, $user, $id) {
        $db = DB::getConnection();
        $this->ensureTable($db);
        $stmt = $db->prepare("SELECT * FROM Prescription WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        $row = $stmt->fetch();
        if (!$row) send_error('Prescription not found', 404);
        send_json($this->decodeRow($row));
    }

    public function update($input, $user, $id) {
        $db = DB::getConnection();
        $this->ensureTable($db);
        $stmt = $db->prepare("SELECT id FROM Prescription WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        if (!$stmt->fetch()) send_error('Prescription not found', 404);

        $fields = [];
        $params = [];
        $text = ['doctorName', 'doctorQualification', 'doctorRegNo', 'date', 'diagnosis',
                 'clinicalNotes', 'investigations', 'followUpDate', 'additionalNotes', 'staffId'];
        foreach ($text as $key) {
            if (array_key_exists($key, $input)) {
                $fields[] = "$key = ?";
                $val = $input[$key];
                $params[] = ($val === '' ? null : $val);
            }
        }
        if (array_key_exists('medicines', $input)) {
            $fields[] = "medicines = ?";
            $params[] = json_encode($this->normalizeMedicines($input['medicines']));
        }
        if (!$fields) send_error('No fields to update', 400);
        $params[] = $id;
        $params[] = $user['clinicId'];
        $db->prepare("UPDATE Prescription SET " . implode(', ', $fields) . " WHERE id = ? AND clinicId = ?")->execute($params);

        $stmt = $db->prepare("SELECT * FROM Prescription WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        send_json($this->decodeRow($stmt->fetch()));
    }

    public function remove($input, $user, $id) {
        $db = DB::getConnection();
        $this->ensureTable($db);
        $stmt = $db->prepare("SELECT id FROM Prescription WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        if (!$stmt->fetch()) send_error('Prescription not found', 404);
        $db->prepare("UPDATE Prescription SET status = 'cancelled' WHERE id = ? AND clinicId = ?")->execute([$id, $user['clinicId']]);
        log_audit($user['clinicId'], $user['id'] ?? null, 'prescription_cancelled', 'Prescription', $id, null, null);
        send_json(['message' => 'Prescription cancelled']);
    }

    public function getPDF($input, $user, $id) {
        $db = DB::getConnection();
        $this->ensureTable($db);

        $stmt = $db->prepare("SELECT * FROM Prescription WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        $rx = $stmt->fetch();
        if (!$rx) send_error('Prescription not found', 404);
        $rx = $this->decodeRow($rx);

        $stmt = $db->prepare("SELECT * FROM Client WHERE id = ? AND clinicId = ?");
        $stmt->execute([$rx['clientId'], $user['clinicId']]);
        $client = $stmt->fetch();

        $stmt = $db->prepare("SELECT * FROM Clinic WHERE id = ?");
        $stmt->execute([$user['clinicId']]);
        $clinic = $stmt->fetch();

        try {
            $pdf = generatePrescriptionPDF($rx, $client, $clinic);
            header('Content-Type: application/pdf');
            header('Content-Disposition: attachment; filename="' . ($rx['prescriptionNo'] ?: 'prescription') . '.pdf"');
            header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
            header('Pragma: no-cache');
            header('Expires: 0');
            echo $pdf;
            exit;
        } catch (Exception $e) {
            send_error($e->getMessage(), 500);
        }
    }

    // ---- Phase 2: frequently-prescribed medicines (autocomplete source) ----
    // Aggregates medicine rows across this clinic's recent prescriptions so the
    // builder can suggest the drugs this clinic actually uses, pre-filling the
    // most common dosage/frequency/duration/instructions for each.
    public function medicineSuggestions($input, $user) {
        $db = DB::getConnection();
        $this->ensureTable($db);
        $stmt = $db->prepare("SELECT medicines FROM Prescription WHERE clinicId = ? AND status != 'cancelled' ORDER BY createdAt DESC LIMIT 500");
        $stmt->execute([$user['clinicId']]);
        $agg = [];
        foreach ($stmt->fetchAll() as $row) {
            $meds = json_decode($row['medicines'] ?? '[]', true);
            if (!is_array($meds)) continue;
            foreach ($meds as $m) {
                $name = trim((string)($m['name'] ?? ''));
                if ($name === '') continue;
                $key = mb_strtolower($name);
                if (!isset($agg[$key])) {
                    $agg[$key] = ['name' => $name, 'count' => 0, 'dosage' => $m['dosage'] ?? '', 'frequency' => $m['frequency'] ?? '', 'duration' => $m['duration'] ?? '', 'instructions' => $m['instructions'] ?? ''];
                }
                $agg[$key]['count']++;
            }
        }
        usort($agg, fn($a, $b) => $b['count'] - $a['count']);
        send_json(array_slice(array_values($agg), 0, 100));
    }

    // ---- Phase 2: reusable prescription templates ----
    private function ensureTemplateTable($db) {
        if (DB_DRIVER === 'sqlite') {
            $db->exec("CREATE TABLE IF NOT EXISTS PrescriptionTemplate (
                id TEXT PRIMARY KEY, clinicId TEXT NOT NULL, name TEXT NOT NULL,
                diagnosis TEXT, medicines TEXT, investigations TEXT, additionalNotes TEXT,
                createdBy TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)");
            $db->exec("CREATE INDEX IF NOT EXISTS IX_RxTemplate_Clinic ON PrescriptionTemplate (clinicId)");
        } else {
            $db->exec("CREATE TABLE IF NOT EXISTS PrescriptionTemplate (
                id VARCHAR(36) NOT NULL, clinicId VARCHAR(36) NOT NULL, name VARCHAR(191) NOT NULL,
                diagnosis TEXT DEFAULT NULL, medicines MEDIUMTEXT DEFAULT NULL, investigations TEXT DEFAULT NULL,
                additionalNotes TEXT DEFAULT NULL, createdBy VARCHAR(36) DEFAULT NULL,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id), KEY IX_RxTemplate_Clinic (clinicId)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
    }

    private function decodeTemplate($row) {
        if (!$row) return $row;
        $row['medicines'] = json_decode($row['medicines'] ?? '[]', true) ?: [];
        return $row;
    }

    public function listTemplates($input, $user) {
        $db = DB::getConnection();
        $this->ensureTemplateTable($db);
        $stmt = $db->prepare("SELECT * FROM PrescriptionTemplate WHERE clinicId = ? ORDER BY name ASC");
        $stmt->execute([$user['clinicId']]);
        send_json(array_map([$this, 'decodeTemplate'], $stmt->fetchAll()));
    }

    public function createTemplate($input, $user) {
        $db = DB::getConnection();
        $this->ensureTemplateTable($db);
        $name = trim((string)($input['name'] ?? ''));
        if ($name === '') send_error('Template name is required', 400);
        $id = generate_uuid();
        $stmt = $db->prepare("INSERT INTO PrescriptionTemplate (id, clinicId, name, diagnosis, medicines, investigations, additionalNotes, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $id, $user['clinicId'], mb_substr($name, 0, 191),
            trim((string)($input['diagnosis'] ?? '')) ?: null,
            json_encode($this->normalizeMedicines($input['medicines'] ?? [])),
            trim((string)($input['investigations'] ?? '')) ?: null,
            trim((string)($input['additionalNotes'] ?? '')) ?: null,
            $user['id'] ?? null,
        ]);
        $stmt = $db->prepare("SELECT * FROM PrescriptionTemplate WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        send_json($this->decodeTemplate($stmt->fetch()), 201);
    }

    public function removeTemplate($input, $user, $id) {
        $db = DB::getConnection();
        $this->ensureTemplateTable($db);
        $stmt = $db->prepare("DELETE FROM PrescriptionTemplate WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        send_json(['message' => 'Template deleted']);
    }
}
