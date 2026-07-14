<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';

class ManualOutreachController {
    private function ensureTable($db) {
        $sql = DB_DRIVER === 'sqlite'
            ? "CREATE TABLE IF NOT EXISTS ManualOutreachLog (
                id TEXT PRIMARY KEY,
                clinicId TEXT NOT NULL,
                clientId TEXT NOT NULL,
                appointmentId TEXT DEFAULT NULL,
                userId TEXT DEFAULT NULL,
                channel TEXT NOT NULL DEFAULT 'whatsapp',
                purpose TEXT NOT NULL DEFAULT 'custom',
                message TEXT DEFAULT NULL,
                status TEXT NOT NULL DEFAULT 'opened',
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP
              )"
            : "CREATE TABLE IF NOT EXISTS ManualOutreachLog (
                id VARCHAR(36) PRIMARY KEY,
                clinicId VARCHAR(36) NOT NULL,
                clientId VARCHAR(36) NOT NULL,
                appointmentId VARCHAR(36) DEFAULT NULL,
                userId VARCHAR(36) DEFAULT NULL,
                channel VARCHAR(30) NOT NULL DEFAULT 'whatsapp',
                purpose VARCHAR(80) NOT NULL DEFAULT 'custom',
                message TEXT DEFAULT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'opened',
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX IX_ManualOutreach_Clinic_Created (clinicId, createdAt),
                INDEX IX_ManualOutreach_Client_Created (clinicId, clientId, createdAt)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $db->exec($sql);
    }

    private function assertClient($db, $clinicId, $clientId) {
        $stmt = $db->prepare("SELECT id, name, phone FROM Client WHERE id = ? AND clinicId = ?");
        $stmt->execute([$clientId, $clinicId]);
        $client = $stmt->fetch();
        if (!$client) send_error('Contact not found for this clinic', 404);
        return $client;
    }

    public function list($input, $user) {
        $db = DB::getConnection();
        $this->ensureTable($db);
        $limit = min(100, max(1, intval($_GET['limit'] ?? 25)));
        $clientId = trim((string)($_GET['clientId'] ?? ''));
        $where = ['l.clinicId = ?'];
        $params = [$user['clinicId']];
        if ($clientId !== '') {
            $where[] = 'l.clientId = ?';
            $params[] = $clientId;
        }
        $userTable = DB_DRIVER === 'sqlite' ? 'User' : '`User`';
        $sql = "SELECT l.*, c.name AS clientName, c.phone AS clientPhone, u.name AS staffName
                FROM ManualOutreachLog l
                LEFT JOIN Client c ON c.id = l.clientId AND c.clinicId = l.clinicId
                LEFT JOIN $userTable u ON u.id = l.userId
                WHERE " . implode(' AND ', $where) . "
                ORDER BY l.createdAt DESC
                LIMIT $limit";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        send_json(['logs' => $stmt->fetchAll()]);
    }

    public function create($input, $user) {
        $db = DB::getConnection();
        $this->ensureTable($db);
        $clientId = trim((string)($input['clientId'] ?? ''));
        if ($clientId === '') send_error('clientId is required', 400);
        $this->assertClient($db, $user['clinicId'], $clientId);

        $appointmentId = trim((string)($input['appointmentId'] ?? ''));
        if ($appointmentId !== '') {
            $stmt = $db->prepare("SELECT id FROM Appointment WHERE id = ? AND clinicId = ? AND clientId = ?");
            $stmt->execute([$appointmentId, $user['clinicId'], $clientId]);
            if (!$stmt->fetch()) send_error('Appointment not found for this contact', 404);
        }

        $allowedPurposes = ['appointment_reminder', 'follow_up', 'payment', 'promotion', 'custom'];
        $purpose = trim((string)($input['purpose'] ?? 'custom'));
        if (!in_array($purpose, $allowedPurposes, true)) $purpose = 'custom';

        $status = trim((string)($input['status'] ?? 'opened')) ?: 'opened';
        $message = trim((string)($input['message'] ?? ''));
        $id = generate_uuid();

        $db->prepare("INSERT INTO ManualOutreachLog (id, clinicId, clientId, appointmentId, userId, channel, purpose, message, status)
                      VALUES (?, ?, ?, ?, ?, 'whatsapp', ?, ?, ?)")
           ->execute([$id, $user['clinicId'], $clientId, $appointmentId ?: null, $user['id'] ?? null, $purpose, $message ?: null, $status]);

        log_audit($user['clinicId'], $user['id'] ?? null, 'manual_whatsapp_opened', 'ManualOutreachLog', $id, null, ['clientId' => $clientId, 'purpose' => $purpose]);
        send_json(['id' => $id, 'message' => 'Manual WhatsApp outreach logged.'], 201);
    }
}
