<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../services/mailService.php';
require_once __DIR__ . '/../services/usernameService.php';

class AuthController {

    // ---------------------------------------------------------------
    // Security helpers
    // ---------------------------------------------------------------

    private function clientIp() {
        // On Hostinger/Cloudflare the real IP may be forwarded
        foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
            if (!empty($_SERVER[$key])) {
                $ip = explode(',', $_SERVER[$key])[0];
                return substr(trim($ip), 0, 45);
            }
        }
        return 'unknown';
    }

    private function recordAttempt($db, $identifier, $success) {
        // createdAt written from PHP so window comparisons use one clock
        // (DB CURRENT_TIMESTAMP may be UTC while PHP runs Asia/Karachi)
        $stmt = $db->prepare("INSERT INTO LoginAttempt (email, ip, success, createdAt) VALUES (?, ?, ?, ?)");
        $stmt->execute([strtolower($identifier), $this->clientIp(), $success ? 1 : 0, date('Y-m-d H:i:s')]);
    }

    private function assertNotRateLimited($db, $identifier) {
        $windowEmail = date('Y-m-d H:i:s', time() - 15 * 60);
        $stmt = $db->prepare(
            "SELECT COUNT(*) FROM LoginAttempt WHERE email = ? AND success = 0 AND createdAt > ?"
        );
        $stmt->execute([strtolower($identifier), $windowEmail]);
        if ((int)$stmt->fetchColumn() >= LOGIN_MAX_ATTEMPTS_EMAIL) {
            send_error('Too many failed attempts. Please try again in 15 minutes.', 429);
        }

        $windowIp = date('Y-m-d H:i:s', time() - 60 * 60);
        $stmt = $db->prepare(
            "SELECT COUNT(*) FROM LoginAttempt WHERE ip = ? AND success = 0 AND createdAt > ?"
        );
        $stmt->execute([$this->clientIp(), $windowIp]);
        if ((int)$stmt->fetchColumn() >= LOGIN_MAX_ATTEMPTS_IP) {
            send_error('Too many requests from this network. Please try again later.', 429);
        }
    }

    private function validatePassword($password, $identifier = '') {
        if (strlen($password) < 10) {
            send_error('Password must be at least 10 characters long', 400);
        }
        if ($identifier !== '' && strcasecmp($password, $identifier) === 0) {
            send_error('Password cannot be the same as your username', 400);
        }
        $common = ['password123', '1234567890', 'qwertyuiop', 'changeme123',
                   'password1234', 'abc1234567', 'clinic12345'];
        if (in_array(strtolower($password), $common, true)) {
            send_error('This password is too common. Please choose a stronger one.', 400);
        }
    }

    private function clinicLogoInitials($name) {
        $words = preg_split('/[^a-z0-9]+/i', trim((string)$name), -1, PREG_SPLIT_NO_EMPTY);
        if (!$words) return 'CL';
        $letters = '';
        foreach ($words as $word) {
            $letters .= strtoupper(substr($word, 0, 1));
            if (strlen($letters) >= 4) break;
        }
        return $letters ?: 'CL';
    }

    private function issueTokens($db, $dbUser) {
        $userPayload = [
            'id' => $dbUser['id'],
            'clinicId' => $dbUser['clinicId'],
            'role' => $dbUser['role'],
            'name' => $dbUser['name']
        ];
        $accessToken = jwt_sign_access($userPayload);
        // jti makes every refresh token unique even when issued within the
        // same second — without it, rotation would reissue an identical JWT
        $refreshToken = jwt_sign_refresh(['id' => $dbUser['id'], 'jti' => bin2hex(random_bytes(8))]);

        $expiresAt = date('Y-m-d H:i:s', time() + JWT_REFRESH_EXPIRES_IN);
        $stmt = $db->prepare("INSERT INTO RefreshToken (id, token, userId, expiresAt) VALUES (?, ?, ?, ?)");
        $stmt->execute([generate_uuid(), $refreshToken, $dbUser['id'], $expiresAt]);

        // Opportunistic prune of expired tokens (cheap, keeps the table small)
        $db->prepare("DELETE FROM RefreshToken WHERE expiresAt < ?")
           ->execute([date('Y-m-d H:i:s')]);

        return [$accessToken, $refreshToken];
    }

    private function revokeAllUserTokens($db, $userId) {
        $db->prepare("DELETE FROM RefreshToken WHERE userId = ?")->execute([$userId]);
    }

    // ---------------------------------------------------------------
    // Endpoints
    // ---------------------------------------------------------------

    public function register($input, $user) {
        $clinicName = $input['clinicName'] ?? '';
        $name = $input['name'] ?? '';
        $usernameInput = $input['username'] ?? '';
        $email = strtolower(trim($input['email'] ?? ''));
        $password = $input['password'] ?? '';

        if (empty($clinicName) || empty($name) || empty($usernameInput) || empty($email) || empty($password)) {
            send_error('All fields are required', 400);
        }
        try {
            $username = pf_username_validate($usernameInput);
        } catch (InvalidArgumentException $e) {
            send_error($e->getMessage(), 400);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            send_error('A valid email address is required', 400);
        }
        $this->validatePassword($password, $username);

        $db = DB::getConnection();

        if (!pf_username_available($db, $username)) {
            send_error('Username already registered', 409);
        }

        $stmt = $db->prepare("SELECT id FROM User WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            send_error('Email already registered', 409);
        }

        try {
            $db->beginTransaction();

            $clinicId = generate_uuid();
            $stmt = $db->prepare("INSERT INTO Clinic (id, name, logo) VALUES (?, ?, ?)");
            $stmt->execute([$clinicId, $clinicName, $this->clinicLogoInitials($clinicName)]);

            $userId = generate_uuid();
            $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
            $stmt = $db->prepare("INSERT INTO User (id, clinicId, name, username, email, password, role) VALUES (?, ?, ?, ?, ?, ?, 'owner')");
            $stmt->execute([$userId, $clinicId, $name, $username, $email, $hash]);

            $dbUser = ['id' => $userId, 'clinicId' => $clinicId, 'role' => 'owner', 'name' => $name];
            list($accessToken, $refreshToken) = $this->issueTokens($db, $dbUser);

            $db->commit();

            send_json([
                'accessToken' => $accessToken,
                'refreshToken' => $refreshToken,
                'user' => [
                    'id' => $userId,
                    'name' => $name,
                    'username' => $username,
                    'email' => $email,
                    'role' => 'owner',
                    'ledgerMode' => 'actual',
                    'clinicId' => $clinicId
                ]
            ], 201);
        } catch (Exception $e) {
            $db->rollBack();
            error_log('register failed: ' . $e->getMessage());
            send_error('Registration failed', 500);
        }
    }

    public function login($input, $user) {
        $identifier = strtolower(trim($input['username'] ?? $input['identifier'] ?? $input['email'] ?? ''));
        $password = $input['password'] ?? '';

        if (empty($identifier) || empty($password)) {
            send_error('Invalid credentials', 401);
        }

        $db = DB::getConnection();
        $this->assertNotRateLimited($db, $identifier);

        $stmt = $db->prepare("SELECT * FROM User WHERE username = ? OR email = ?");
        $stmt->execute([$identifier, $identifier]);
        $dbUser = $stmt->fetch();

        if (!$dbUser || !$dbUser['isActive'] || !password_verify($password, $dbUser['password'])) {
            $this->recordAttempt($db, $identifier, false);
            send_error('Invalid credentials', 401);
        }

        $this->recordAttempt($db, $identifier, true);

        $stmt = $db->prepare("UPDATE User SET lastLogin = CURRENT_TIMESTAMP WHERE id = ?");
        $stmt->execute([$dbUser['id']]);

        list($accessToken, $refreshToken) = $this->issueTokens($db, $dbUser);

        send_json([
            'accessToken' => $accessToken,
            'refreshToken' => $refreshToken,
            'user' => [
                'id' => $dbUser['id'],
                'name' => $dbUser['name'],
                'username' => $dbUser['username'] ?? null,
                'email' => $dbUser['email'],
                'role' => $dbUser['role'],
                'ledgerMode' => $dbUser['ledgerMode'],
                'clinicId' => $dbUser['clinicId']
            ]
        ]);
    }

    public function usernameAvailability($input, $user) {
        $raw = $_GET['username'] ?? ($input['username'] ?? '');
        $excludeUserId = trim((string)($_GET['excludeUserId'] ?? ($input['excludeUserId'] ?? ''))) ?: null;
        try {
            $username = pf_username_validate($raw);
        } catch (InvalidArgumentException $e) {
            send_json(['available' => false, 'valid' => false, 'message' => $e->getMessage()]);
        }

        $db = DB::getConnection();
        send_json([
            'username' => $username,
            'valid' => true,
            'available' => pf_username_available($db, $username, $excludeUserId),
        ]);
    }

    public function refresh($input, $user) {
        $refreshToken = $input['refreshToken'] ?? '';
        if (empty($refreshToken)) {
            send_error('Refresh token required', 400);
        }

        try {
            $payload = jwt_verify_refresh($refreshToken);
        } catch (Exception $e) {
            send_error('Invalid refresh token', 401);
        }

        $db = DB::getConnection();
        $stmt = $db->prepare("SELECT * FROM RefreshToken WHERE token = ?");
        $stmt->execute([$refreshToken]);
        $storedToken = $stmt->fetch();

        if (!$storedToken || strtotime($storedToken['expiresAt']) < time()) {
            // Token reuse or theft signal: a validly-signed refresh token that is
            // not in the store means it was already rotated. Revoke everything.
            if (!$storedToken && !empty($payload['id'])) {
                $this->revokeAllUserTokens($db, $payload['id']);
                error_log('Refresh token reuse detected for user ' . $payload['id'] . ' — all sessions revoked');
            }
            send_error('Refresh token expired or invalid', 401);
        }

        $stmt = $db->prepare("SELECT * FROM User WHERE id = ?");
        $stmt->execute([$payload['id']]);
        $dbUser = $stmt->fetch();

        if (!$dbUser || !$dbUser['isActive']) {
            send_error('User inactive', 401);
        }

        // Rotation: retire the used token, issue a fresh pair
        $db->prepare("DELETE FROM RefreshToken WHERE id = ?")->execute([$storedToken['id']]);
        list($accessToken, $newRefreshToken) = $this->issueTokens($db, $dbUser);

        send_json([
            'accessToken' => $accessToken,
            'refreshToken' => $newRefreshToken
        ]);
    }

    public function forgotPassword($input, $user) {
        $email = strtolower(trim($input['email'] ?? ''));
        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            send_error('A valid email address is required', 400);
        }

        $db = DB::getConnection();
        // Keep reset throttling separate from failed-login counters. Otherwise
        // anyone could lock a known user out by requesting five reset emails.
        $resetRateKey = 'reset:' . $email;
        $this->assertNotRateLimited($db, $resetRateKey);
        $this->recordAttempt($db, $resetRateKey, false);

        $stmt = $db->prepare("SELECT id, name, email FROM User WHERE email = ? AND isActive = 1");
        $stmt->execute([$email]);
        $dbUser = $stmt->fetch();

        if ($dbUser) {
            // Invalidate any previous unused reset links for this user
            $db->prepare("UPDATE PasswordReset SET usedAt = CURRENT_TIMESTAMP WHERE userId = ? AND usedAt IS NULL")
               ->execute([$dbUser['id']]);

            $rawToken = bin2hex(random_bytes(32));
            $tokenHash = hash('sha256', $rawToken);
            $expiresAt = date('Y-m-d H:i:s', time() + PASSWORD_RESET_TTL);

            $stmt = $db->prepare("INSERT INTO PasswordReset (id, userId, tokenHash, expiresAt) VALUES (?, ?, ?, ?)");
            $stmt->execute([generate_uuid(), $dbUser['id'], $tokenHash, $expiresAt]);

            $resetUrl = rtrim(CLIENT_URL, '/') . '/reset-password?token=' . $rawToken;
            $ttlMinutes = (int)(PASSWORD_RESET_TTL / 60);
            send_app_email(
                $dbUser['email'],
                'Reset your portal password',
                password_reset_email_html($dbUser['name'], $resetUrl, $ttlMinutes)
            );
        }

        // Always the same response whether or not the email exists (no enumeration)
        send_json(['message' => 'If that email is registered, a reset link has been sent.']);
    }

    public function resetPassword($input, $user) {
        $rawToken = $input['token'] ?? '';
        $password = $input['password'] ?? '';

        if (empty($rawToken) || empty($password)) {
            send_error('Token and new password are required', 400);
        }

        $db = DB::getConnection();
        $tokenHash = hash('sha256', $rawToken);

        $stmt = $db->prepare("SELECT * FROM PasswordReset WHERE tokenHash = ?");
        $stmt->execute([$tokenHash]);
        $reset = $stmt->fetch();

        if (!$reset || $reset['usedAt'] !== null || strtotime($reset['expiresAt']) < time()) {
            send_error('This reset link is invalid or has expired. Please request a new one.', 400);
        }

        $stmt = $db->prepare("SELECT id, username, email, clinicId FROM User WHERE id = ? AND isActive = 1");
        $stmt->execute([$reset['userId']]);
        $dbUser = $stmt->fetch();
        if (!$dbUser) {
            send_error('This reset link is invalid or has expired. Please request a new one.', 400);
        }

        $this->validatePassword($password, $dbUser['username'] ?: $dbUser['email']);

        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        $db->prepare("UPDATE User SET password = ? WHERE id = ?")->execute([$hash, $dbUser['id']]);
        $db->prepare("UPDATE PasswordReset SET usedAt = CURRENT_TIMESTAMP WHERE id = ?")->execute([$reset['id']]);

        // Force re-login everywhere with the new password
        $this->revokeAllUserTokens($db, $dbUser['id']);

        log_audit($dbUser['clinicId'], $dbUser['id'], 'password_reset', 'User', $dbUser['id']);

        send_json(['message' => 'Password updated. Please sign in with your new password.']);
    }

    public function logout($input, $user) {
        $refreshToken = $input['refreshToken'] ?? '';
        if (!empty($refreshToken)) {
            $db = DB::getConnection();
            $stmt = $db->prepare("DELETE FROM RefreshToken WHERE token = ?");
            $stmt->execute([$refreshToken]);
        }
        send_json(['message' => 'Logged out']);
    }

    public function logoutAll($input, $user) {
        $db = DB::getConnection();
        $this->revokeAllUserTokens($db, $user['id']);
        send_json(['message' => 'Logged out from all devices']);
    }

    public function me($input, $user) {
        $db = DB::getConnection();
        $stmt = $db->prepare("SELECT id, name, username, email, role, ledgerMode, clinicId, lastLogin, createdAt FROM User WHERE id = ?");
        $stmt->execute([$user['id']]);
        $dbUser = $stmt->fetch();

        if (!$dbUser) {
            send_error('User not found', 404);
        }
        send_json($dbUser);
    }
}
