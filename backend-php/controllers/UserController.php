<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../services/usernameService.php';

class UserController {
    private $allowedRoles = ['owner', 'manager', 'doctor', 'therapist', 'accountant', 'receptionist', 'staff'];
    private $allowedLedgerModes = ['actual', 'regular'];

    public function list($input, $user) {
        if ($user['role'] !== 'owner') {
            send_error('Insufficient permissions', 403);
        }
        
        $db = DB::getConnection();
        $stmt = $db->prepare("SELECT id, name, username, email, role, ledgerMode, isActive, lastLogin, createdAt FROM User WHERE clinicId = ? ORDER BY createdAt ASC");
        $stmt->execute([$user['clinicId']]);
        $users = $stmt->fetchAll();
        send_json($users);
    }

    public function create($input, $user) {
        if ($user['role'] !== 'owner') {
            send_error('Insufficient permissions', 403);
        }

        $name = $input['name'] ?? '';
        $usernameInput = $input['username'] ?? '';
        $email = $input['email'] ?? '';
        $password = $input['password'] ?? '';
        $role = $input['role'] ?? '';
        $ledgerMode = $input['ledgerMode'] ?? 'actual';

        if (empty($name) || empty($usernameInput) || empty($email) || empty($password) || empty($role)) {
            send_error('name, username, email, password, and role are required', 400);
        }
        try {
            $username = pf_username_validate($usernameInput);
        } catch (InvalidArgumentException $e) {
            send_error($e->getMessage(), 400);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            send_error('A valid contact email is required', 400);
        }
        if (strlen($password) < 10) {
            send_error('Password must be at least 10 characters', 400);
        }

        if (!in_array($role, $this->allowedRoles)) {
            send_error('Invalid role', 400);
        }

        $mode = in_array($ledgerMode, $this->allowedLedgerModes) ? $ledgerMode : 'actual';
        $normalizedEmail = strtolower(trim($email));

        $db = DB::getConnection();
        if (!pf_username_available($db, $username)) {
            send_error('Username already registered', 409);
        }
        $stmt = $db->prepare("SELECT id FROM User WHERE email = ?");
        $stmt->execute([$normalizedEmail]);
        if ($stmt->fetch()) {
            send_error('Email already registered', 409);
        }

        $id = generate_uuid();
        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

        $stmt = $db->prepare("INSERT INTO User (id, clinicId, name, username, email, password, role, ledgerMode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$id, $user['clinicId'], $name, $username, $normalizedEmail, $hash, $role, $mode]);

        send_json([
            'id' => $id,
            'name' => $name,
            'username' => $username,
            'email' => $normalizedEmail,
            'role' => $role,
            'ledgerMode' => $mode,
            'isActive' => true
        ], 201);
    }

    public function update($input, $user, $id) {
        if ($user['role'] !== 'owner') {
            send_error('Insufficient permissions', 403);
        }

        $db = DB::getConnection();
        $stmt = $db->prepare("SELECT * FROM User WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        $existing = $stmt->fetch();

        if (!$existing) {
            send_error('User not found', 404);
        }

        $fields = [];
        $params = [];

        if (isset($input['name'])) {
            $fields[] = "name = ?";
            $params[] = $input['name'];
        }
        if (isset($input['username'])) {
            try {
                $username = pf_username_validate($input['username']);
            } catch (InvalidArgumentException $e) {
                send_error($e->getMessage(), 400);
            }
            if ($username !== ($existing['username'] ?? '')) {
                if (!pf_username_available($db, $username, $id)) {
                    send_error('Username already in use', 409);
                }
            }
            $fields[] = "username = ?";
            $params[] = $username;
        }
        if (isset($input['email'])) {
            $normalizedEmail = strtolower(trim($input['email']));
            if ($normalizedEmail !== $existing['email']) {
                $stmtCheck = $db->prepare("SELECT id FROM User WHERE email = ?");
                $stmtCheck->execute([$normalizedEmail]);
                if ($stmtCheck->fetch()) {
                    send_error('Email already in use', 409);
                }
            }
            $fields[] = "email = ?";
            $params[] = $normalizedEmail;
        }
        if (isset($input['role'])) {
            if (!in_array($input['role'], $this->allowedRoles)) {
                send_error('Invalid role', 400);
            }
            $fields[] = "role = ?";
            $params[] = $input['role'];
        }
        if (isset($input['isActive'])) {
            $fields[] = "isActive = ?";
            $params[] = $input['isActive'] ? 1 : 0;
        }
        if (isset($input['ledgerMode'])) {
            if (!in_array($input['ledgerMode'], $this->allowedLedgerModes)) {
                send_error('Invalid ledgerMode', 400);
            }
            $fields[] = "ledgerMode = ?";
            $params[] = $input['ledgerMode'];
        }

        if (empty($fields)) {
            send_error('No fields to update', 400);
        }

        $params[] = $id;
        $params[] = $user['clinicId'];

        $sql = "UPDATE User SET " . implode(", ", $fields) . " WHERE id = ? AND clinicId = ?";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        // Fetch updated user
        $stmt = $db->prepare("SELECT id, name, username, email, role, ledgerMode, isActive FROM User WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        $updatedUser = $stmt->fetch();

        send_json($updatedUser);
    }

    public function resetPassword($input, $user, $id) {
        if ($user['role'] !== 'owner') {
            send_error('Insufficient permissions', 403);
        }

        $newPassword = $input['newPassword'] ?? '';
        if (empty($newPassword) || strlen($newPassword) < 10) {
            send_error('newPassword must be at least 10 characters', 400);
        }

        $db = DB::getConnection();
        $stmt = $db->prepare("SELECT id FROM User WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        if (!$stmt->fetch()) {
            send_error('User not found', 404);
        }

        $hash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
        $stmt = $db->prepare("UPDATE User SET password = ? WHERE id = ? AND clinicId = ?");
        $stmt->execute([$hash, $id, $user['clinicId']]);

        // Revoke all refresh tokens
        $stmt = $db->prepare("DELETE FROM RefreshToken WHERE userId = ?");
        $stmt->execute([$id]);

        send_json(['message' => 'Password reset']);
    }

    public function remove($input, $user, $id) {
        if ($user['role'] !== 'owner') {
            send_error('Insufficient permissions', 403);
        }

        if ($id === $user['id']) {
            send_error('You cannot delete your own account', 400);
        }

        $db = DB::getConnection();
        $stmt = $db->prepare("SELECT id FROM User WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);
        if (!$stmt->fetch()) {
            send_error('User not found', 404);
        }

        $stmt = $db->prepare("DELETE FROM RefreshToken WHERE userId = ?");
        $stmt->execute([$id]);

        $stmt = $db->prepare("UPDATE User SET isActive = 0 WHERE id = ? AND clinicId = ?");
        $stmt->execute([$id, $user['clinicId']]);

        log_audit($user['clinicId'], $user['id'] ?? null, 'user_deactivated', 'User', $id, null, null);
        send_json(['message' => 'User deactivated']);
    }
}
