<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../services/dentalFinancialService.php';
require_once __DIR__ . '/../services/clinicalSafetyPolicyService.php';

class ClientController {
    private function assertClientInClinic($db, $id, $clinicId) {
        $stmt = $db->prepare("SELECT id FROM Client WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $clinicId]);
        if (!$stmt->fetch()) {
            send_error('Client not found', 404);
        }
    }

    public function list($input, $user) {
        $search = $_GET['search'] ?? '';
        $specialty = $_GET['specialty'] ?? '';
        $status = $_GET['status'] ?? '';
        $tier = $_GET['tier'] ?? '';
        $page = max(1, isset($_GET['page']) ? intval($_GET['page']) : 1);
        $limit = min(100, max(1, isset($_GET['limit']) ? intval($_GET['limit']) : 50));
        $offset = ($page - 1) * $limit;

        $db = DB::getConnection();
        
        $where = ["clinicId = ?"];
        $params = [$user['clinicId']];

        if (!empty($search)) {
            $where[] = "(name LIKE ? OR phone LIKE ? OR email LIKE ? OR patientNo LIKE ?)";
            $searchParam = "%$search%";
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $searchParam;
        }
        if (!empty($specialty)) {
            $where[] = "specialty LIKE ?";
            $params[] = "%$specialty%";
        }
        if (!empty($status)) {
            $where[] = "status = ?";
            $params[] = $status;
        } else {
            // Hide soft-deleted (deactivated) patients from the default list
            $where[] = "status != 'inactive'";
        }
        if (!empty($tier)) {
            $where[] = "loyaltyTier = ?";
            $params[] = $tier;
        }

        $whereSql = implode(" AND ", $where);

        // Get total count
        $countStmt = $db->prepare("SELECT COUNT(*) FROM Client WHERE $whereSql");
        $countStmt->execute($params);
        $total = intval($countStmt->fetchColumn());

        // Get clients
        $stmt = $db->prepare("SELECT * FROM Client WHERE $whereSql ORDER BY createdAt DESC LIMIT $limit OFFSET $offset");
        $stmt->execute($params);
        $clients = $stmt->fetchAll();

        send_json([
            'clients' => $clients,
            'total' => $total,
            'page' => $page,
            'pages' => ceil($total / $limit)
        ]);
    }

    public function getById($input, $user, $id) {
        $db = DB::getConnection();
        $stmt = $db->prepare("SELECT * FROM Client WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        $client = $stmt->fetch();
        
        if (!$client) {
            send_error('Client not found', 404);
        }

        // Per-patient P&L for privileged roles: revenue collected (totalSpent),
        // procedure cost incurred, and net profit. Cost/profit hidden otherwise.
        if (pf_can_manage_procedure_costs($user)) {
            try {
                // Canonical cost source = InvoiceProcedureCost (same as clinic P&L).
                $stmt = $db->prepare("SELECT COALESCE(SUM(procedureCost), 0) FROM InvoiceProcedureCost WHERE clientId = ? AND clinicId = ?");
                $stmt->execute([$id, $user['clinicId']]);
                $procedureCost = floatval($stmt->fetchColumn() ?: 0);
            } catch (Exception $e) { $procedureCost = 0; }
            $revenue = floatval($client['totalSpent'] ?? 0);
            $client['procedureCostTotal'] = $procedureCost;
            $client['netProfit'] = $revenue - $procedureCost;
            $client['canViewCost'] = true;
        }

        send_json($client);
    }

    public function create($input, $user) {
        $db = DB::getConnection();

        if (array_key_exists('medicalHistory', $input) && pf_input_has_meaningful_value($input['medicalHistory'])) {
            pf_enforce_clinical_capability($db, $user['clinicId'], 'medicalHistoryEntryEnabled', 'Medical-history entry is unavailable while PatientFlow is operating as an operations platform.');
        }

        $id = generate_uuid();
        $patientNo = $input['patientNo'] ?? '';
        
        if (empty($patientNo)) {
            $countStmt = $db->prepare("SELECT COUNT(*) FROM Client WHERE clinicId = ?");
            $countStmt->execute([$user['clinicId']]);
            $count = intval($countStmt->fetchColumn());
            $patientNo = 'PT-' . str_pad($count + 1, 4, '0', STR_PAD_LEFT);
        }

        $name = $input['name'] ?? '';
        if (empty($name)) {
            send_error('Name is required', 400);
        }

        $phone = $input['phone'] ?? null;
        $email = $input['email'] ?? null;
        $dob = $input['dob'] ?? null;
        $gender = $input['gender'] ?? null;
        $specialty = isset($input['specialty']) ? (is_array($input['specialty']) ? json_encode($input['specialty']) : $input['specialty']) : '[]';
        $medicalHistory = isset($input['medicalHistory']) ? (is_array($input['medicalHistory']) ? json_encode($input['medicalHistory']) : $input['medicalHistory']) : '[]';
        $notes = $input['notes'] ?? null;
        $referredBy = $input['referredBy'] ?? null;
        $avatarColor = $input['avatarColor'] ?? '#6366f1';
        
        $initials = $input['initials'] ?? '';
        if (empty($initials) && !empty($name)) {
            $parts = explode(' ', $name);
            $initials = strtoupper(substr($parts[0], 0, 1) . (isset($parts[1]) ? substr($parts[1], 0, 1) : ''));
            $initials = substr($initials, 0, 2);
        }

        $stmt = $db->prepare("INSERT INTO Client (id, clinicId, patientNo, name, phone, email, dob, gender, specialty, medicalHistory, avatarColor, initials, notes, referredBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $id, $user['clinicId'], $patientNo, $name, $phone, $email, $dob, $gender, $specialty, $medicalHistory, $avatarColor, $initials, $notes, $referredBy
        ]);

        // Get created client
        $stmt = $db->prepare("SELECT * FROM Client WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        $client = $stmt->fetch();

        send_json($client, 201);
    }

    public function update($input, $user, $id) {
        $db = DB::getConnection();
        $this->assertClientInClinic($db, $id, $user['clinicId']);

        if (array_key_exists('medicalHistory', $input)) {
            pf_enforce_clinical_capability($db, $user['clinicId'], 'medicalHistoryEntryEnabled', 'Medical-history entry is unavailable while PatientFlow is operating as an operations platform.');
        }

        $fields = [];
        $params = [];

        $updatable = ['patientNo', 'name', 'phone', 'email', 'dob', 'gender', 'status', 'loyaltyTier', 'avatarColor', 'initials', 'notes', 'referredBy'];
        foreach ($updatable as $key) {
            if (isset($input[$key])) {
                $fields[] = "$key = ?";
                $params[] = $input[$key];
            }
        }

        if (isset($input['specialty'])) {
            $fields[] = "specialty = ?";
            $params[] = is_array($input['specialty']) ? json_encode($input['specialty']) : $input['specialty'];
        }
        if (isset($input['medicalHistory'])) {
            $fields[] = "medicalHistory = ?";
            $params[] = is_array($input['medicalHistory']) ? json_encode($input['medicalHistory']) : $input['medicalHistory'];
        }

        if (empty($fields)) {
            send_error('No fields to update', 400);
        }

        $params[] = $id;
        $params[] = $user['clinicId'];

        $sql = "UPDATE Client SET " . implode(", ", $fields) . " WHERE id = ? AND clinicId = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        // Fetch updated client
        $stmt = $db->prepare("SELECT * FROM Client WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        $client = $stmt->fetch();

        send_json($client);
    }

    public function remove($input, $user, $id) {
        $db = DB::getConnection();
        $this->assertClientInClinic($db, $id, $user['clinicId']);

        $stmt = $db->prepare("UPDATE Client SET status = 'inactive' WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);

        log_audit($user['clinicId'], $user['id'] ?? null, 'client_deactivated', 'Client', $id, null, ['by' => $user['role'] ?? '']);
        send_json(['message' => 'Client deactivated']);
    }

    public function getAppointments($input, $user, $id) {
        $db = DB::getConnection();
        $this->assertClientInClinic($db, $id, $user['clinicId']);
        $stmt = $db->prepare("
            SELECT a.*, 
                   s.name as staffName, s.role as staffRole,
                   srv.name as serviceName
            FROM Appointment a
            LEFT JOIN Staff s ON a.staffId = s.id AND s.clinicId = a.clinicId
            LEFT JOIN Service srv ON a.serviceId = srv.id AND srv.clinicId = a.clinicId
            WHERE a.clientId = ? AND a.clinicId = ?
            ORDER BY a.date DESC, a.startTime DESC
        ");
        $stmt->execute([$id, $user['clinicId']]);
        $appointments = $stmt->fetchAll();

        // format to match prisma include structures
        $formatted = [];
        foreach ($appointments as $row) {
            $row['staff'] = ['name' => $row['staffName'], 'role' => $row['staffRole']];
            $row['service'] = ['name' => $row['serviceName']];
            unset($row['staffName'], $row['staffRole'], $row['serviceName']);
            $formatted[] = $row;
        }

        send_json($formatted);
    }

    public function getPackages($input, $user, $id) {
        $db = DB::getConnection();
        $this->assertClientInClinic($db, $id, $user['clinicId']);
        $stmt = $db->prepare("
            SELECT cp.*, 
                   p.name as packageName, p.description as packageDescription, p.totalPrice as packagePrice
            FROM ClientPackage cp
            LEFT JOIN Package p ON cp.packageId = p.id
            WHERE cp.clientId = ? AND p.clinicId = ?
        ");
        $stmt->execute([$id, $user['clinicId']]);
        $packages = $stmt->fetchAll();

        $formatted = [];
        foreach ($packages as $row) {
            $row['package'] = [
                'id' => $row['packageId'],
                'name' => $row['packageName'],
                'description' => $row['packageDescription'],
                'totalPrice' => $row['packagePrice']
            ];
            unset($row['packageName'], $row['packageDescription'], $row['packagePrice']);
            $formatted[] = $row;
        }

        send_json($formatted);
    }

    public function generatePortalCredentials($input, $user, $id) {
        $email = $input['email'] ?? '';
        $password = $input['password'] ?? '';

        if (empty($email) || empty($password)) {
            send_error('email and password are required', 400);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            send_error('A valid email address is required', 400);
        }
        if (strlen($password) < 10) {
            send_error('Password must be at least 10 characters', 400);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);

        $db = DB::getConnection();
        $this->assertClientInClinic($db, $id, $user['clinicId']);

        $stmt = $db->prepare("UPDATE Client SET portalEmail = ?, portalPasswordHash = ? WHERE id = ? AND clinicId = ?");
        $stmt->execute([$email, $hash, $id, $user['clinicId']]);

        send_json(['message' => 'Portal credentials set']);
    }
}
