<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// Base64Url encoding / decoding
function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data) {
    return base64_decode(strtr($data, '-_', '+/'));
}

// JWT Sign Access Token
function jwt_sign_access($payload) {
    return jwt_sign($payload, JWT_SECRET, JWT_EXPIRES_IN);
}

// JWT Sign Refresh Token
function jwt_sign_refresh($payload) {
    return jwt_sign($payload, JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES_IN);
}

// JWT Sign Generic
function jwt_sign($payload, $secret, $expiry_seconds) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload['exp'] = time() + $expiry_seconds;
    $payload_json = json_encode($payload);
    
    $base64UrlHeader = base64url_encode($header);
    $base64UrlPayload = base64url_encode($payload_json);
    
    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
    $base64UrlSignature = base64url_encode($signature);
    
    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}

// JWT Verify Access
function jwt_verify_access($token) {
    return jwt_verify($token, JWT_SECRET);
}

// JWT Verify Refresh
function jwt_verify_refresh($token) {
    return jwt_verify($token, JWT_REFRESH_SECRET);
}

// JWT Verify Generic
function jwt_verify($token, $secret) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        throw new Exception("Invalid token structure");
    }
    
    list($base64UrlHeader, $base64UrlPayload, $base64UrlSignature) = $parts;
    
    $signature = base64url_decode($base64UrlSignature);
    $expected_sig = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
    
    if (!hash_equals($signature, $expected_sig)) {
        throw new Exception("Signature verification failed");
    }
    
    $payload = json_decode(base64url_decode($base64UrlPayload), true);
    if (isset($payload['exp']) && $payload['exp'] < time()) {
        throw new Exception("Token has expired");
    }
    
    return $payload;
}

// Generate UUIDv4
function generate_uuid() {
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4)
        . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20, 12);
}

// JSON Send Helpers
function send_json($data, $status_code = 200) {
    header('Content-Type: application/json');
    http_response_code($status_code);
    echo json_encode($data);
    exit;
}

function send_error($message, $status_code = 400, $extra = []) {
    $response = ['error' => $message];
    if (!empty($extra)) {
        $response = array_merge($response, $extra);
    }
    send_json($response, $status_code);
}

// Audit Log Helper
function log_audit($clinicId, $userId, $action, $entity, $entityId = null, $oldData = null, $newData = null) {
    try {
        $db = DB::getConnection();
        $stmt = $db->prepare("INSERT INTO AuditLog (id, clinicId, userId, action, entity, entityId, oldData, newData, ip, userAgent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            generate_uuid(),
            $clinicId,
            $userId,
            $action,
            $entity,
            $entityId,
            $oldData ? json_encode($oldData) : null,
            $newData ? json_encode($newData) : null,
            $_SERVER['REMOTE_ADDR'] ?? null,
            $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);
    } catch (Exception $e) {
        // Silently ignore audit log failures so they don't block the API
    }
}

// Multi-tenant: resolve which clinic a request belongs to from its host.
// Priority: exact custom domain (e.g. portal.thesmilexperts.com)
//           then slug subdomain ({slug}.crea8ivmedia.com).
// Returns the Clinic row or null (caller decides the fallback).

// Default branded URL every new clinic gets: <slug>.clinic.crea8ivmedia.com.
// Picks the longest available -<n> suffix only if needed for uniqueness.
function default_clinic_subdomain($db, $slug, $excludeClinicId = null) {
    $suffix = '.' . TENANT_DOMAIN_SUFFIX;
    $base = $slug ?: 'clinic';
    $candidate = $base . $suffix;
    $sql = "SELECT id FROM Clinic WHERE LOWER(customDomain) = ?" . ($excludeClinicId ? " AND id != ?" : "");
    for ($i = 2; $i < 20; $i++) {
        $stmt = $db->prepare($sql);
        $stmt->execute($excludeClinicId ? [$candidate, $excludeClinicId] : [$candidate]);
        if (!$stmt->fetch()) return $candidate;
        $candidate = $base . '-' . $i . $suffix;
    }
    return $candidate;
}

function find_clinic_by_domain($db, $host) {
    $host = strtolower(trim((string)$host));
    if ($host === '') return null;
    // Strip scheme and port if a full origin was passed
    if (strpos($host, '://') !== false) {
        $host = parse_url($host, PHP_URL_HOST) ?: $host;
    }
    $host = preg_replace('/:\d+$/', '', $host);
    if ($host === '') return null;

    // 1) Exact custom domain match
    $stmt = $db->prepare("SELECT * FROM Clinic WHERE customDomain IS NOT NULL AND LOWER(customDomain) = ?");
    $stmt->execute([$host]);
    $clinic = $stmt->fetch();
    if ($clinic) return $clinic;

    // 2) Slug subdomain ({slug}.base.tld) — at least 3 labels, skip "www"/"clinic"
    $parts = explode('.', $host);
    if (count($parts) >= 3) {
        $slug = $parts[0];
        if (!in_array($slug, ['www', 'clinic', 'app', 'api', 'portal'], true)) {
            $stmt = $db->prepare("SELECT * FROM Clinic WHERE slug = ?");
            $stmt->execute([$slug]);
            $clinic = $stmt->fetch();
            if ($clinic) return $clinic;
        }
    }
    return null;
}

// The host that clinic custom domains should CNAME to.
function portal_host() {
    return getenv('PORTAL_HOST') ?: 'clinic.crea8ivmedia.com';
}

// Verify a clinic controls a custom domain. Passes if ANY holds:
//   - CNAME of {domain} resolves to the portal host, OR
//   - TXT record at {domain} contains "crea8iv-verify={token}" (survives CNAME
//     flattening on proxied domains), OR
//   - {domain} A records match the portal host's A records.
// Returns [bool ok, string detail].
function verify_domain_dns($domain, $token) {
    // Dev escape hatch: real DNS can't resolve test domains locally.
    if (APP_ENV === 'development' && (($_GET['mockDns'] ?? '') === 'ok')) {
        return [true, 'mock'];
    }

    $base = portal_host();

    // Cap DNS work so a clinic verifying before propagation can't hang the
    // request near max_execution_time (NXDOMAIN lookups can be slow).
    @set_time_limit(20);

    // 1) CNAME check
    $cname = @dns_get_record($domain, DNS_CNAME);
    if (is_array($cname)) {
        foreach ($cname as $r) {
            if (isset($r['target']) && rtrim(strtolower($r['target']), '.') === strtolower($base)) {
                return [true, 'cname'];
            }
        }
    }

    // 2) TXT ownership token
    if ($token) {
        $txt = @dns_get_record($domain, DNS_TXT);
        if (is_array($txt)) {
            foreach ($txt as $r) {
                if (isset($r['txt']) && strpos($r['txt'], 'crea8iv-verify=' . $token) !== false) {
                    return [true, 'txt'];
                }
            }
        }
    }

    // 3) A-record match (handles CNAME flattening)
    $domainA = @dns_get_record($domain, DNS_A);
    $baseA = @dns_get_record($base, DNS_A);
    if (is_array($domainA) && is_array($baseA) && $domainA && $baseA) {
        $dIps = array_filter(array_map(fn($r) => $r['ip'] ?? null, $domainA));
        $bIps = array_filter(array_map(fn($r) => $r['ip'] ?? null, $baseA));
        if ($dIps && $bIps && array_intersect($dIps, $bIps)) {
            return [true, 'a-record'];
        }
    }

    return [false, 'DNS records not found yet. Changes can take up to 24 hours to propagate.'];
}

// Send SMS/WhatsApp Mock
function send_whatsapp_message($to, $body) {
    if (empty(TWILIO_ACCOUNT_SID) || empty(TWILIO_AUTH_TOKEN)) {
        return false;
    }
    // Simple Twilio API call
    $url = "https://api.twilio.com/2010-04-01/Accounts/" . TWILIO_ACCOUNT_SID . "/Messages.json";
    $data = [
        'From' => TWILIO_WHATSAPP_FROM,
        'To' => 'whatsapp:' . $to,
        'Body' => $body
    ];
    $options = [
        'http' => [
            'header'  => "Content-type: application/x-www-form-urlencoded\r\n" .
                         "Authorization: Basic " . base64_encode(TWILIO_ACCOUNT_SID . ":" . TWILIO_AUTH_TOKEN) . "\r\n",
            'method'  => 'POST',
            'content' => http_build_query($data),
            'ignore_errors' => true
        ]
    ];
    $context  = stream_context_create($options);
    $result = @file_get_contents($url, false, $context);
    return $result !== false;
}

// ---------------------------------------------------------------------------
// Signed file URLs — patient uploads must NOT be directly web-accessible.
// Files under uploads/ are denied by .htaccess; the API serves them through
// GET /api/v1/files/{token}?exp=..&sig=.. where sig = HMAC(relPath|exp).
// Response-time conversion: stored DB values stay "/uploads/<clinic>/<file>".
// ---------------------------------------------------------------------------
function pf_b64url_encode($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
function pf_b64url_decode($s) {
    $pad = strlen($s) % 4;
    if ($pad) $s .= str_repeat('=', 4 - $pad);
    return base64_decode(strtr($s, '-_', '+/'), true);
}

function pf_file_sig($relPath, $exp) {
    return hash_hmac('sha256', $relPath . '|' . $exp, JWT_SECRET);
}

// Absolute signed URL for a path relative to UPLOAD_DIR (e.g. "clinic-x/img.png").
function pf_file_signed_url($relPath, $ttlSeconds = 1800) {
    $exp = time() + max(60, (int)$ttlSeconds);
    $token = pf_b64url_encode($relPath);
    return API_PUBLIC_URL . '/files/' . rawurlencode($token) . '?exp=' . $exp . '&sig=' . pf_file_sig($relPath, $exp);
}

// Convert a stored "/uploads/<rel>" URL to a signed URL; anything else passes through.
function pf_uploads_url_to_signed($url, $ttlSeconds = 1800) {
    if (!is_string($url) || strpos($url, '/uploads/') !== 0) return $url;
    return pf_file_signed_url(substr($url, strlen('/uploads/')), $ttlSeconds);
}
