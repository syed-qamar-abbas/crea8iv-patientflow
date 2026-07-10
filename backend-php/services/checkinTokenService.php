<?php
require_once __DIR__ . '/../helpers.php';

const PF_CHECKIN_TOKEN_PREFIX = 'PFCHK:v1:';
const PF_CHECKIN_TOKEN_BYTES = 32;
const PF_CHECKIN_TOKEN_TTL_SECONDS = 900;

class CheckinTokenException extends RuntimeException {
    public $reasonCode;
    public $httpStatus;

    public function __construct($reasonCode, $message, $httpStatus) {
        parent::__construct($message);
        $this->reasonCode = $reasonCode;
        $this->httpStatus = $httpStatus;
    }
}

function pf_checkin_token_raw() {
    return base64url_encode(random_bytes(PF_CHECKIN_TOKEN_BYTES));
}

function pf_checkin_token_payload($rawToken) {
    return PF_CHECKIN_TOKEN_PREFIX . $rawToken;
}

function pf_checkin_token_parse_payload($payload) {
    $pattern = '/^' . preg_quote(PF_CHECKIN_TOKEN_PREFIX, '/') . '([A-Za-z0-9_-]{43})$/D';
    if (!is_string($payload) || !preg_match($pattern, $payload, $matches)) {
        throw new CheckinTokenException('malformed_token', 'Invalid check-in QR code', 400);
    }
    return $matches[1];
}

function pf_checkin_token_hash($rawToken) {
    return hash('sha256', $rawToken);
}

function pf_checkin_token_revoke_reason($reason) {
    $allowed = ['regenerated', 'revoked_by_user', 'security_reset', 'appointment_changed', 'expired_cleanup', 'qr_generation_failed'];
    $value = trim((string)$reason);
    return in_array($value, $allowed, true) ? $value : 'revoked_by_user';
}

function pf_checkin_token_ensure_table($db) {
    if (DB_DRIVER === 'sqlite') {
        $db->exec("CREATE TABLE IF NOT EXISTS AppointmentCheckinToken (
            id TEXT NOT NULL PRIMARY KEY,
            clinicId TEXT NOT NULL,
            appointmentId TEXT NOT NULL,
            tokenHash TEXT NOT NULL UNIQUE,
            issuedByUserId TEXT DEFAULT NULL,
            issuedAt TEXT NOT NULL,
            expiresAt TEXT NOT NULL,
            usedAt TEXT DEFAULT NULL,
            usedByUserId TEXT DEFAULT NULL,
            revokedAt TEXT DEFAULT NULL,
            revokeReason TEXT DEFAULT NULL,
            createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (clinicId) REFERENCES Clinic(id) ON DELETE CASCADE,
            FOREIGN KEY (appointmentId) REFERENCES Appointment(id) ON DELETE CASCADE,
            FOREIGN KEY (issuedByUserId) REFERENCES User(id) ON DELETE SET NULL,
            FOREIGN KEY (usedByUserId) REFERENCES User(id) ON DELETE SET NULL
        )");
        $db->exec("CREATE INDEX IF NOT EXISTS IX_CheckinToken_Clinic_Appointment
            ON AppointmentCheckinToken(clinicId, appointmentId, revokedAt, expiresAt)");
        $db->exec("CREATE INDEX IF NOT EXISTS IX_CheckinToken_Appointment_Used
            ON AppointmentCheckinToken(appointmentId, usedAt)");
        return;
    }

    $db->exec("CREATE TABLE IF NOT EXISTS `AppointmentCheckinToken` (
        `id` VARCHAR(36) NOT NULL,
        `clinicId` VARCHAR(36) NOT NULL,
        `appointmentId` VARCHAR(36) NOT NULL,
        `tokenHash` CHAR(64) NOT NULL,
        `issuedByUserId` VARCHAR(36) DEFAULT NULL,
        `issuedAt` DATETIME NOT NULL,
        `expiresAt` DATETIME NOT NULL,
        `usedAt` DATETIME DEFAULT NULL,
        `usedByUserId` VARCHAR(36) DEFAULT NULL,
        `revokedAt` DATETIME DEFAULT NULL,
        `revokeReason` VARCHAR(255) DEFAULT NULL,
        `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        UNIQUE KEY `UK_CheckinToken_Hash` (`tokenHash`),
        KEY `IX_CheckinToken_Clinic_Appointment` (`clinicId`, `appointmentId`, `revokedAt`, `expiresAt`),
        KEY `IX_CheckinToken_Appointment_Used` (`appointmentId`, `usedAt`),
        CONSTRAINT `FK_CheckinToken_Clinic` FOREIGN KEY (`clinicId`) REFERENCES `Clinic` (`id`) ON DELETE CASCADE,
        CONSTRAINT `FK_CheckinToken_Appointment` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment` (`id`) ON DELETE CASCADE,
        CONSTRAINT `FK_CheckinToken_IssuedBy` FOREIGN KEY (`issuedByUserId`) REFERENCES `User` (`id`) ON DELETE SET NULL,
        CONSTRAINT `FK_CheckinToken_UsedBy` FOREIGN KEY (`usedByUserId`) REFERENCES `User` (`id`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function pf_checkin_token_begin($db) {
    if ($db->inTransaction()) return false;
    $db->beginTransaction();
    return true;
}

function pf_checkin_token_appointment($db, $clinicId, $appointmentId, $lock = false) {
    $sql = "SELECT id, clinicId, clientId, price, status, checkedIn FROM Appointment WHERE id = ? AND clinicId = ?";
    if ($lock && DB_DRIVER === 'mysql') $sql .= ' FOR UPDATE';
    $stmt = $db->prepare($sql);
    $stmt->execute([$appointmentId, $clinicId]);
    return $stmt->fetch();
}

function pf_checkin_token_assert_eligible($appointment) {
    if (!$appointment) {
        throw new CheckinTokenException('appointment_not_found', 'Appointment not found', 404);
    }
    if (!empty($appointment['checkedIn'])) {
        throw new CheckinTokenException('appointment_checked_in', 'Appointment is already checked in', 409);
    }
    if (in_array($appointment['status'] ?? '', ['cancelled', 'completed', 'no-show'], true)) {
        throw new CheckinTokenException('appointment_unavailable', 'Appointment is not eligible for check-in', 409);
    }
}

function pf_issue_checkin_token($db, $clinicId, $appointmentId, $issuedByUserId, $ttlSeconds = PF_CHECKIN_TOKEN_TTL_SECONDS) {
    pf_checkin_token_ensure_table($db);
    $ownsTransaction = pf_checkin_token_begin($db);
    try {
        $appointment = pf_checkin_token_appointment($db, $clinicId, $appointmentId, true);
        pf_checkin_token_assert_eligible($appointment);

        $now = date('Y-m-d H:i:s');
        $ttl = max(60, min(3600, intval($ttlSeconds)));
        $expiresAt = date('Y-m-d H:i:s', time() + $ttl);

        $db->prepare("UPDATE AppointmentCheckinToken
                         SET revokedAt = ?, revokeReason = 'regenerated'
                       WHERE clinicId = ? AND appointmentId = ?
                         AND usedAt IS NULL AND revokedAt IS NULL")
           ->execute([$now, $clinicId, $appointmentId]);

        $rawToken = pf_checkin_token_raw();
        $id = generate_uuid();
        $db->prepare("INSERT INTO AppointmentCheckinToken
            (id, clinicId, appointmentId, tokenHash, issuedByUserId, issuedAt, expiresAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)")
           ->execute([$id, $clinicId, $appointmentId, pf_checkin_token_hash($rawToken), $issuedByUserId ?: null, $now, $expiresAt]);

        if ($ownsTransaction) $db->commit();
        return [
            'id' => $id,
            'rawToken' => $rawToken,
            'payload' => pf_checkin_token_payload($rawToken),
            'expiresAt' => $expiresAt,
        ];
    } catch (Throwable $e) {
        if ($ownsTransaction && $db->inTransaction()) $db->rollBack();
        throw $e;
    }
}

function pf_revoke_checkin_tokens($db, $clinicId, $appointmentId, $reason = 'revoked') {
    pf_checkin_token_ensure_table($db);
    $appointment = pf_checkin_token_appointment($db, $clinicId, $appointmentId);
    if (!$appointment) {
        throw new CheckinTokenException('appointment_not_found', 'Appointment not found', 404);
    }

    $now = date('Y-m-d H:i:s');
    $cleanReason = pf_checkin_token_revoke_reason($reason);
    $stmt = $db->prepare("UPDATE AppointmentCheckinToken
                            SET revokedAt = ?, revokeReason = ?
                          WHERE clinicId = ? AND appointmentId = ?
                            AND usedAt IS NULL AND revokedAt IS NULL");
    $stmt->execute([$now, $cleanReason, $clinicId, $appointmentId]);
    return $stmt->rowCount();
}

function pf_manual_checkin_appointment($db, $clinicId, $appointmentId) {
    $appointment = pf_checkin_token_appointment($db, $clinicId, $appointmentId);
    if (!$appointment) {
        throw new CheckinTokenException('appointment_not_found', 'Appointment not found', 404);
    }

    $now = date('Y-m-d H:i:s');
    $db->prepare("UPDATE Appointment
                     SET checkedIn = 1, checkinTime = ?, status = 'confirmed'
                   WHERE id = ? AND clinicId = ?")
       ->execute([$now, $appointmentId, $clinicId]);
    $appointment['checkedInAt'] = $now;
    return $appointment;
}

function pf_consume_checkin_token($db, $clinicId, $payload, $usedByUserId) {
    pf_checkin_token_ensure_table($db);
    $rawToken = pf_checkin_token_parse_payload($payload);
    $tokenHash = pf_checkin_token_hash($rawToken);
    $ownsTransaction = pf_checkin_token_begin($db);

    try {
        $sql = "SELECT t.*, a.clientId, a.price, a.status appointmentStatus, a.checkedIn
                  FROM AppointmentCheckinToken t
                  JOIN Appointment a ON a.id = t.appointmentId AND a.clinicId = t.clinicId
                 WHERE t.tokenHash = ? AND t.clinicId = ?";
        if (DB_DRIVER === 'mysql') $sql .= ' FOR UPDATE';
        $stmt = $db->prepare($sql);
        $stmt->execute([$tokenHash, $clinicId]);
        $token = $stmt->fetch();

        if (!$token) {
            throw new CheckinTokenException('token_not_found', 'Invalid check-in QR code', 404);
        }
        if ($token['usedAt'] !== null) {
            throw new CheckinTokenException('token_used', 'This check-in QR code has already been used', 409);
        }
        if ($token['revokedAt'] !== null) {
            throw new CheckinTokenException('token_revoked', 'This check-in QR code has been revoked', 409);
        }
        if (strtotime($token['expiresAt']) < time()) {
            throw new CheckinTokenException('token_expired', 'This check-in QR code has expired', 410);
        }

        $appointment = [
            'id' => $token['appointmentId'],
            'clinicId' => $token['clinicId'],
            'clientId' => $token['clientId'],
            'price' => $token['price'],
            'status' => $token['appointmentStatus'],
            'checkedIn' => $token['checkedIn'],
        ];
        pf_checkin_token_assert_eligible($appointment);

        $now = date('Y-m-d H:i:s');
        $consume = $db->prepare("UPDATE AppointmentCheckinToken
                                   SET usedAt = ?, usedByUserId = ?
                                 WHERE id = ? AND clinicId = ?
                                   AND usedAt IS NULL AND revokedAt IS NULL");
        $consume->execute([$now, $usedByUserId ?: null, $token['id'], $clinicId]);
        if ($consume->rowCount() !== 1) {
            throw new CheckinTokenException('token_used', 'This check-in QR code is no longer valid', 409);
        }

        $db->prepare("UPDATE Appointment
                         SET checkedIn = 1, checkinTime = ?, status = 'confirmed'
                       WHERE id = ? AND clinicId = ?")
           ->execute([$now, $token['appointmentId'], $clinicId]);

        $points = floor(floatval($token['price'] ?? 0) / 100);
        if ($points > 0) {
            $db->prepare("UPDATE Client SET loyaltyPoints = loyaltyPoints + ? WHERE id = ? AND clinicId = ?")
               ->execute([$points, $token['clientId'], $clinicId]);
        }

        if ($ownsTransaction) $db->commit();
        return [
            'tokenId' => $token['id'],
            'appointmentId' => $token['appointmentId'],
            'clientId' => $token['clientId'],
            'price' => floatval($token['price'] ?? 0),
            'loyaltyPointsAwarded' => $points,
            'checkedInAt' => $now,
        ];
    } catch (Throwable $e) {
        if ($ownsTransaction && $db->inTransaction()) $db->rollBack();
        throw $e;
    }
}
