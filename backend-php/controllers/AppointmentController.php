<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../services/whatsappAutomationService.php';
require_once __DIR__ . '/../services/checkinTokenService.php';
require_once __DIR__ . '/../services/qrService.php';

class AppointmentController {
    private function validateDateTimeRange($date, $startTime, $endTime) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)
            || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $startTime)
            || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $endTime)) {
            send_error('Invalid date, startTime, or endTime format', 400);
        }
        [$year, $month, $day] = array_map('intval', explode('-', $date));
        if (!checkdate($month, $day, $year) || $endTime <= $startTime) {
            send_error('Appointment end time must be after the start time', 400);
        }
    }

    private function assertClinicRecord($db, $table, $id, $clinicId, $extraWhere = '') {
        if ($id === null || $id === '') return;
        $sql = "SELECT id FROM $table WHERE id = ? AND clinicId = ?" . $extraWhere;
        $stmt = $db->prepare($sql);
        $stmt->execute([$id, $clinicId]);
        if (!$stmt->fetch()) {
            send_error('Related record not found for this clinic', 400);
        }
    }

    private function resolveSpecialty($db, $serviceId, $staffId, $fallback = '') {
        if (!empty($fallback)) return $fallback;
        if (!empty($serviceId)) {
            $stmt = $db->prepare("SELECT specialty FROM Service WHERE id = ?");
            $stmt->execute([$serviceId]);
            $value = $stmt->fetchColumn();
            if (!empty($value)) return $value;
        }
        if (!empty($staffId)) {
            $stmt = $db->prepare("SELECT specialty FROM Staff WHERE id = ?");
            $stmt->execute([$staffId]);
            $value = $stmt->fetchColumn();
            if (!empty($value)) return $value;
        }
        return 'general';
    }

    private function checkConflict($db, $clinicId, $staffId, $date, $startTime, $endTime, $excludeId = null) {
        $sql = "SELECT * FROM Appointment 
                WHERE clinicId = ? 
                  AND staffId = ? 
                  AND date = ? 
                  AND status IN ('confirmed', 'pending') 
                  AND startTime < ? 
                  AND endTime > ?";
        $params = [$clinicId, $staffId, $date, $endTime, $startTime];
        if ($excludeId !== null) {
            $sql .= " AND id != ?";
            $params[] = $excludeId;
        }
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function list($input, $user) {
        $date = $_GET['date'] ?? '';
        $staffId = $_GET['staffId'] ?? '';
        $specialty = $_GET['specialty'] ?? '';
        $status = $_GET['status'] ?? '';
        $branchId = $_GET['branchId'] ?? '';
        $from = $_GET['from'] ?? '';
        $to = $_GET['to'] ?? '';
        $sort = $_GET['sort'] ?? 'date_desc';
        // Whitelisted sort options (default: most recent appointment date first).
        $sortMap = [
            'date_desc'   => 'a.date DESC, a.startTime DESC',
            'date_asc'    => 'a.date ASC, a.startTime ASC',
            'patient_asc' => 'c.name ASC, a.date DESC',
            'doctor_asc'  => 's.name ASC, a.date DESC',
            'status_asc'  => 'a.status ASC, a.date DESC',
            'amount_desc' => 'a.price DESC',
        ];
        $orderBy = $sortMap[$sort] ?? $sortMap['date_desc'];
        $limit = isset($_GET['limit']) ? min(200, max(1, intval($_GET['limit']))) : 0;
        $page = max(1, intval($_GET['page'] ?? 1));
        $offset = ($page - 1) * max(1, $limit);

        $db = DB::getConnection();
        $where = ["a.clinicId = ?"];
        $params = [$user['clinicId']];

        if (!empty($date)) {
            $where[] = "a.date = ?";
            $params[] = $date;
        }
        if (!empty($staffId)) {
            $where[] = "a.staffId = ?";
            $params[] = $staffId;
        }
        if (!empty($specialty)) {
            $where[] = "a.specialty = ?";
            $params[] = $specialty;
        }
        if (!empty($status)) {
            $where[] = "a.status = ?";
            $params[] = $status;
        }
        if (!empty($branchId)) {
            $where[] = "a.branchId = ?";
            $params[] = $branchId;
        }
        if (!empty($from) && !empty($to)) {
            $where[] = "a.date >= ? AND a.date <= ?";
            $params[] = $from;
            $params[] = $to;
        }

        $whereSql = implode(" AND ", $where);
        
        $sql = "SELECT a.*, 
                       c.name as clientName, c.phone as clientPhone, c.avatarColor as clientAvatarColor, c.initials as clientInitials,
                       s.name as staffName, s.role as staffRole, s.avatarColor as staffAvatarColor,
                       srv.name as serviceName
                FROM Appointment a
                LEFT JOIN Client c ON a.clientId = c.id AND c.clinicId = a.clinicId
                LEFT JOIN Staff s ON a.staffId = s.id AND s.clinicId = a.clinicId
                LEFT JOIN Service srv ON a.serviceId = srv.id AND srv.clinicId = a.clinicId
                WHERE $whereSql
                ORDER BY $orderBy";
        if ($limit > 0) {
            $sql .= " LIMIT $limit OFFSET $offset";
        }

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $appointments = $stmt->fetchAll();

        // format to match prisma include structure
        $formatted = [];
        foreach ($appointments as $row) {
            $row['client'] = [
                'id' => $row['clientId'],
                'name' => $row['clientName'],
                'phone' => $row['clientPhone'],
                'avatarColor' => $row['clientAvatarColor'],
                'initials' => $row['clientInitials']
            ];
            $row['staff'] = [
                'id' => $row['staffId'],
                'name' => $row['staffName'],
                'role' => $row['staffRole'],
                'avatarColor' => $row['staffAvatarColor']
            ];
            $row['service'] = [
                'id' => $row['serviceId'],
                'name' => $row['serviceName']
            ];
            unset(
                $row['clientName'], $row['clientPhone'], $row['clientAvatarColor'], $row['clientInitials'],
                $row['staffName'], $row['staffRole'], $row['staffAvatarColor'], $row['serviceName']
            );
            $formatted[] = $row;
        }

        send_json($formatted);
    }

    public function getById($input, $user, $id) {
        $db = DB::getConnection();
        $sql = "SELECT a.*,
                       c.name as clientName, c.phone as clientPhone, c.email as clientEmail, c.dob as clientDob, c.gender as clientGender, c.patientNo as clientPatientNo, c.avatarColor as clientAvatarColor, c.initials as clientInitials,
                       s.name as staffName, s.role as staffRole, s.avatarColor as staffAvatarColor,
                       srv.name as serviceName
                FROM Appointment a
                LEFT JOIN Client c ON a.clientId = c.id AND c.clinicId = a.clinicId
                LEFT JOIN Staff s ON a.staffId = s.id AND s.clinicId = a.clinicId
                LEFT JOIN Service srv ON a.serviceId = srv.id AND srv.clinicId = a.clinicId
                WHERE a.id = ? AND a.clinicId = ?";
        
        $stmt = $db->prepare($sql);
        $stmt->execute([$id, $user['clinicId']]);
        $appt = $stmt->fetch();

        if (!$appt) {
            send_error('Appointment not found', 404);
        }

        $appt['client'] = [
            'id' => $appt['clientId'],
            'name' => $appt['clientName'],
            'phone' => $appt['clientPhone'],
            'email' => $appt['clientEmail'],
            'dob' => $appt['clientDob'],
            'gender' => $appt['clientGender'],
            'patientNo' => $appt['clientPatientNo'],
            'avatarColor' => $appt['clientAvatarColor'],
            'initials' => $appt['clientInitials']
        ];
        $appt['staff'] = [
            'id' => $appt['staffId'],
            'name' => $appt['staffName'],
            'role' => $appt['staffRole'],
            'avatarColor' => $appt['staffAvatarColor']
        ];
        $appt['service'] = [
            'id' => $appt['serviceId'],
            'name' => $appt['serviceName']
        ];
        unset(
            $appt['clientName'], $appt['clientPhone'], $appt['clientEmail'], $appt['clientDob'], $appt['clientGender'], $appt['clientPatientNo'], $appt['clientAvatarColor'], $appt['clientInitials'],
            $appt['staffName'], $appt['staffRole'], $appt['staffAvatarColor'], $appt['serviceName']
        );

        send_json($appt);
    }

    public function create($input, $user) {
        $db = DB::getConnection();
        
        $id = generate_uuid();
        $branchId = $input['branchId'] ?? null;
        $clientId = $input['clientId'] ?? '';
        $staffId = $input['staffId'] ?? '';
        $serviceId = $input['serviceId'] ?? null;
        $date = $input['date'] ?? '';
        $startTime = $input['startTime'] ?? '';
        $endTime = $input['endTime'] ?? '';
        $duration = intval($input['duration'] ?? 0);
        $price = floatval($input['price'] ?? 0);
        $specialty = $this->resolveSpecialty($db, $serviceId, $staffId, $input['specialty'] ?? '');
        $room = $input['room'] ?? null;
        $notes = $input['notes'] ?? null;
        $status = $input['status'] ?? 'pending';

        if (empty($clientId) || empty($staffId) || empty($date) || empty($startTime) || empty($endTime)) {
            send_error('clientId, staffId, date, startTime, and endTime are required', 400);
        }
        $this->validateDateTimeRange($date, $startTime, $endTime);
        if ($duration <= 0) {
            $duration = (int)((strtotime("$date $endTime") - strtotime("$date $startTime")) / 60);
        }
        if ($price < 0) send_error('Appointment price cannot be negative', 400);
        if (!in_array($status, ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'], true)) {
            send_error('Invalid appointment status', 400);
        }

        $this->assertClinicRecord($db, 'Client', $clientId, $user['clinicId'], " AND status != 'inactive'");
        $this->assertClinicRecord($db, 'Staff', $staffId, $user['clinicId'], " AND status = 'active'");
        $this->assertClinicRecord($db, 'Service', $serviceId, $user['clinicId'], " AND isActive = 1");
        $this->assertClinicRecord($db, 'Branch', $branchId, $user['clinicId'], " AND isActive = 1");

        // Conflict check
        $conflicts = $this->checkConflict($db, $user['clinicId'], $staffId, $date, $startTime, $endTime);
        if (!empty($conflicts)) {
            send_error('Time slot conflict: staff already has an appointment in this period', 409, ['conflicts' => $conflicts]);
        }

        $stmt = $db->prepare("INSERT INTO Appointment (id, clinicId, branchId, clientId, staffId, serviceId, date, startTime, endTime, duration, status, room, notes, price, specialty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $id, $user['clinicId'], $branchId, $clientId, $staffId, $serviceId, $date, $startTime, $endTime, $duration, $status, $room, $notes, $price, $specialty
        ]);

        $stmt = $db->prepare("SELECT * FROM Appointment WHERE id = ?");
        $stmt->execute([$id]);
        $appt = $stmt->fetch();

        whatsapp_automation_dispatch_trigger($user['clinicId'], 'appointment_booked', $id, $clientId);
        send_json($appt, 201);
    }

    public function update($input, $user, $id) {
        $db = DB::getConnection();
        
        $stmt = $db->prepare("SELECT * FROM Appointment WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        $existing = $stmt->fetch();

        if (!$existing) {
            send_error('Appointment not found', 404);
        }

        $staffId = $input['staffId'] ?? $existing['staffId'];
        $serviceId = $input['serviceId'] ?? $existing['serviceId'];
        $clientId = $input['clientId'] ?? $existing['clientId'];
        $branchId = array_key_exists('branchId', $input) ? $input['branchId'] : $existing['branchId'];
        $date = $input['date'] ?? $existing['date'];
        $startTime = $input['startTime'] ?? $existing['startTime'];
        $endTime = $input['endTime'] ?? $existing['endTime'];
        $this->validateDateTimeRange($date, $startTime, $endTime);
        if ((isset($input['duration']) && intval($input['duration']) <= 0)
            || (isset($input['price']) && floatval($input['price']) < 0)) {
            send_error('Duration must be positive and price cannot be negative', 400);
        }

        $this->assertClinicRecord($db, 'Client', $clientId, $user['clinicId'], " AND status != 'inactive'");
        $this->assertClinicRecord($db, 'Staff', $staffId, $user['clinicId'], " AND status = 'active'");
        $this->assertClinicRecord($db, 'Service', $serviceId, $user['clinicId'], " AND isActive = 1");
        $this->assertClinicRecord($db, 'Branch', $branchId, $user['clinicId'], " AND isActive = 1");
        if (isset($input['status']) && !in_array($input['status'], ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'], true)) {
            send_error('Invalid appointment status', 400);
        }

        // If time details updated, run conflict check
        if (isset($input['staffId']) || isset($input['date']) || isset($input['startTime']) || isset($input['endTime'])) {
            $conflicts = $this->checkConflict($db, $user['clinicId'], $staffId, $date, $startTime, $endTime, $id);
            if (!empty($conflicts)) {
                send_error('Time slot conflict', 409, ['conflicts' => $conflicts]);
            }
        }

        $fields = [];
        $params = [];
        if (!isset($input['specialty']) && (isset($input['serviceId']) || isset($input['staffId']))) {
            $input['specialty'] = $this->resolveSpecialty($db, $serviceId, $staffId, $existing['specialty'] ?? '');
        }
        $updatable = ['branchId', 'clientId', 'staffId', 'serviceId', 'date', 'startTime', 'endTime', 'duration', 'status', 'room', 'notes', 'price', 'specialty'];
        foreach ($updatable as $key) {
            if (isset($input[$key])) {
                $fields[] = "$key = ?";
                $params[] = $input[$key];
            }
        }

        if (empty($fields)) {
            send_error('No fields to update', 400);
        }

        $params[] = $id;
        $params[] = $user['clinicId'];

        $sql = "UPDATE Appointment SET " . implode(", ", $fields) . " WHERE id = ? AND clinicId = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        $stmt = $db->prepare("SELECT * FROM Appointment WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        $appt = $stmt->fetch();

        send_json($appt);
    }

    public function cancel($input, $user, $id) {
        $db = DB::getConnection();
        $stmt = $db->prepare("UPDATE Appointment SET status = 'cancelled' WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        log_audit($user['clinicId'], $user['id'] ?? null, 'appointment_cancelled', 'Appointment', $id, null, null);
        send_json(['message' => 'Cancelled']);
    }

    // Dedicated reschedule: move date/time, keep everything else, record the
    // old→new in notes + audit, re-confirm, and conflict-check.
    public function reschedule($input, $user, $id) {
        $db = DB::getConnection();
        $stmt = $db->prepare("SELECT * FROM Appointment WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        $existing = $stmt->fetch();
        if (!$existing) send_error('Appointment not found', 404);

        $date = $input['date'] ?? '';
        $startTime = $input['startTime'] ?? '';
        if (empty($date) || empty($startTime)) send_error('New date and time are required', 400);

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)
            || !preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $startTime)) {
            send_error('Invalid date or startTime format', 400);
        }
        [$year, $month, $day] = array_map('intval', explode('-', $date));
        if (!checkdate($month, $day, $year)) send_error('Invalid appointment date', 400);

        $duration = intval($existing['duration'] ?: 30);
        $endTime = date('H:i', strtotime("$date $startTime") + $duration * 60);

        $conflicts = $this->checkConflict($db, $user['clinicId'], $existing['staffId'], $date, $startTime, $endTime, $id);
        if (!empty($conflicts)) send_error('Time slot conflict', 409, ['conflicts' => $conflicts]);

        $note = trim(($existing['notes'] ?? '') . "\nRescheduled from {$existing['date']} {$existing['startTime']} → $date $startTime");
        $db->prepare("UPDATE Appointment SET date = ?, startTime = ?, endTime = ?, status = 'confirmed', notes = ? WHERE id = ? AND clinicId = ?")
           ->execute([$date, $startTime, $endTime, $note, $id, $user['clinicId']]);

        log_audit($user['clinicId'], $user['id'] ?? null, 'appointment_rescheduled', 'Appointment', $id,
                  ['date' => $existing['date'], 'startTime' => $existing['startTime']],
                  ['date' => $date, 'startTime' => $startTime]);

        $stmt = $db->prepare("SELECT * FROM Appointment WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        send_json($stmt->fetch());
    }

    // Archive appointment through the historical DELETE route. We retain the
    // row for clinical/legal history and reporting; cancelled slots stop
    // blocking future bookings because conflict checks only include pending/confirmed.
    public function remove($input, $user, $id) {
        $db = DB::getConnection();
        $stmt = $db->prepare("SELECT id, notes FROM Appointment WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        $appointment = $stmt->fetch();
        if (!$appointment) send_error('Appointment not found', 404);

        $note = trim(($appointment['notes'] ?? '') . "\nArchived from appointment list by " . ($user['role'] ?? 'user') . ' on ' . date('Y-m-d H:i:s'));
        $db->prepare("UPDATE Appointment SET status = 'cancelled', notes = ? WHERE id = ? AND clinicId = ?")
           ->execute([$note, $id, $user['clinicId']]);
        log_audit($user['clinicId'], $user['id'] ?? null, 'appointment_archived', 'Appointment', $id, null, null);
        send_json(['message' => 'Appointment archived']);
    }

    public function checkIn($input, $user, $id) {
        $db = DB::getConnection();
        try {
            $appt = pf_manual_checkin_appointment($db, $user['clinicId'], $id);
        } catch (CheckinTokenException $e) {
            send_error($e->getMessage(), $e->httpStatus, ['code' => $e->reasonCode]);
        }

        // Award loyalty points
        $points = floor(floatval($appt['price']) / 100);
        if ($points > 0) {
            $stmt = $db->prepare("UPDATE Client SET loyaltyPoints = loyaltyPoints + ? WHERE id = ? AND clinicId = ?");
            $stmt->execute([$points, $appt['clientId'], $user['clinicId']]);
        }

        send_json(['message' => 'Checked in']);
    }

    public function issueCheckinToken($input, $user, $id) {
        $db = DB::getConnection();
        try {
            $token = pf_issue_checkin_token($db, $user['clinicId'], $id, $user['id'] ?? null);
            $qrImage = pf_render_checkin_qr_data_uri($token['payload']);
            log_audit($user['clinicId'], $user['id'] ?? null, 'checkin_token_issued', 'Appointment', $id, null, [
                'tokenId' => $token['id'],
                'expiresAt' => $token['expiresAt'],
            ]);
            send_json([
                'qrImage' => $qrImage,
                'expiresAt' => $token['expiresAt'],
            ], 201);
        } catch (CheckinTokenException $e) {
            send_error($e->getMessage(), $e->httpStatus, ['code' => $e->reasonCode]);
        }
    }

    public function revokeCheckinToken($input, $user, $id) {
        $db = DB::getConnection();
        $reason = pf_checkin_token_revoke_reason($input['reason'] ?? 'revoked_by_user');
        try {
            $revoked = pf_revoke_checkin_tokens($db, $user['clinicId'], $id, $reason);
            log_audit($user['clinicId'], $user['id'] ?? null, 'checkin_token_revoked', 'Appointment', $id, null, [
                'revokedCount' => $revoked,
                'reason' => $reason,
            ]);
            send_json(['message' => 'Check-in QR revoked', 'revoked' => $revoked]);
        } catch (CheckinTokenException $e) {
            send_error($e->getMessage(), $e->httpStatus, ['code' => $e->reasonCode]);
        }
    }

    public function scanCheckinToken($input, $user) {
        $payload = $input['payload'] ?? '';
        $db = DB::getConnection();
        try {
            $result = pf_consume_checkin_token($db, $user['clinicId'], $payload, $user['id'] ?? null);

            log_audit($user['clinicId'], $user['id'] ?? null, 'checkin_token_consumed', 'Appointment', $result['appointmentId'], null, [
                'tokenId' => $result['tokenId'],
                'checkedInAt' => $result['checkedInAt'],
            ]);
            send_json([
                'message' => 'Checked in',
                'appointmentId' => $result['appointmentId'],
                'checkedInAt' => $result['checkedInAt'],
            ]);
        } catch (CheckinTokenException $e) {
            send_error($e->getMessage(), $e->httpStatus, ['code' => $e->reasonCode]);
        }
    }

    public function getToday($input, $user) {
        $db = DB::getConnection();
        $today = date('Y-m-d');
        
        $sql = "SELECT a.*, 
                       c.name as clientName, c.avatarColor as clientAvatarColor, c.initials as clientInitials,
                       s.name as staffName,
                       srv.name as serviceName
                FROM Appointment a
                LEFT JOIN Client c ON a.clientId = c.id AND c.clinicId = a.clinicId
                LEFT JOIN Staff s ON a.staffId = s.id AND s.clinicId = a.clinicId
                LEFT JOIN Service srv ON a.serviceId = srv.id AND srv.clinicId = a.clinicId
                WHERE a.clinicId = ? AND a.date = ?
                ORDER BY a.startTime ASC";

        $stmt = $db->prepare($sql);
        $stmt->execute([$user['clinicId'], $today]);
        $appointments = $stmt->fetchAll();

        $formatted = [];
        foreach ($appointments as $row) {
            $row['client'] = [
                'id' => $row['clientId'],
                'name' => $row['clientName'],
                'avatarColor' => $row['clientAvatarColor'],
                'initials' => $row['clientInitials']
            ];
            $row['staff'] = [
                'id' => $row['staffId'],
                'name' => $row['staffName']
            ];
            $row['service'] = [
                'id' => $row['serviceId'],
                'name' => $row['serviceName']
            ];
            unset(
                $row['clientName'], $row['clientAvatarColor'], $row['clientInitials'],
                $row['staffName'], $row['serviceName']
            );
            $formatted[] = $row;
        }

        send_json($formatted);
    }

    public function getConflicts($input, $user) {
        $staffId = $_GET['staffId'] ?? '';
        $date = $_GET['date'] ?? '';
        $startTime = $_GET['startTime'] ?? '';
        $endTime = $_GET['endTime'] ?? '';

        if (empty($staffId) || empty($date) || empty($startTime) || empty($endTime)) {
            send_error('staffId, date, startTime, and endTime are required', 400);
        }

        $db = DB::getConnection();
        $this->assertClinicRecord($db, 'Staff', $staffId, $user['clinicId'], " AND status = 'active'");
        $conflicts = $this->checkConflict($db, $user['clinicId'], $staffId, $date, $startTime, $endTime);
        
        send_json([
            'hasConflict' => !empty($conflicts),
            'conflicts' => $conflicts
        ]);
    }
}
