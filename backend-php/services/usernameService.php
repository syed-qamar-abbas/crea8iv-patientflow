<?php

function pf_username_normalize($value) {
    return strtolower(trim(ltrim((string)$value, '@')));
}

function pf_username_sanitize_base($value, $fallback = 'user') {
    $base = pf_username_normalize($value);
    if (strpos($base, '@') !== false) {
        $base = explode('@', $base)[0];
    }
    $base = preg_replace('/[^a-z0-9._-]+/', '-', $base);
    $base = preg_replace('/[._-]{2,}/', '-', $base);
    $base = trim($base, '._-');
    $base = substr($base ?: $fallback, 0, 24);
    if (strlen($base) < 3) $base = $fallback . '-' . $base;
    return trim($base, '._-') ?: $fallback;
}

function pf_username_validate($username) {
    $username = pf_username_normalize($username);
    if ($username === '') {
        throw new InvalidArgumentException('Username is required');
    }
    if (strlen($username) < 3 || strlen($username) > 32) {
        throw new InvalidArgumentException('Username must be 3 to 32 characters');
    }
    if (!preg_match('/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/', $username)) {
        throw new InvalidArgumentException('Username can use letters, numbers, dots, hyphens, and underscores, and must start and end with a letter or number');
    }
    if (strpos($username, '@') !== false) {
        throw new InvalidArgumentException('Username must not be an email address');
    }
    return $username;
}

function pf_username_available($db, $username, $excludeUserId = null) {
    $username = pf_username_validate($username);
    $sql = "SELECT id FROM User WHERE username = ?" . ($excludeUserId ? " AND id != ?" : "") . " LIMIT 1";
    $stmt = $db->prepare($sql);
    $stmt->execute($excludeUserId ? [$username, $excludeUserId] : [$username]);
    return !$stmt->fetch();
}

function pf_username_make_unique($db, $seed) {
    $base = pf_username_sanitize_base($seed);
    $candidate = pf_username_validate($base);
    $i = 2;
    while (!pf_username_available($db, $candidate)) {
        $suffix = '-' . $i++;
        $candidate = substr($base, 0, 32 - strlen($suffix)) . $suffix;
    }
    return $candidate;
}
