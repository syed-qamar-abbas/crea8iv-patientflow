<?php
/**
 * Crea8iv PatientFlow API — front controller.
 *
 * Every API request enters here. The pipeline is:
 *   1. CORS          — cors_origin_allowed() sets Access-Control-* headers.
 *   2. Auth resolve  — check_auth() decodes the Bearer JWT into $user (or null).
 *   3. Route match   — the path is matched against the route table below; each
 *                      row is [METHOD, PATTERN(regex), Controller, action, guard].
 *   4. Guard         — false=public, 'auth'=any user, true=active tenant,
 *                      'admin'=super-admin, 'client'=client portal,
 *                      [roles...]=tenant + one of the listed roles. Tenant routes
 *                      also pass through require_package_feature() for plan gating.
 *   5. Dispatch      — the controller action runs and emits JSON.
 *
 * See PROJECT_DOCUMENTATION.md ("Request Flow") for the full description.
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/services/packageService.php';

// Handle CORS — allowlist: the configured portal/website origins, localhost dev,
// the platform domain crea8ivmedia.com and its subdomains (legacy
// crea8ivpatientflow.com kept during transition), plus any clinic's registered
// custom domain (and its parent) for white-label portals and booking widgets.
function cors_origin_allowed($origin) {
    if ($origin === '') return false;
    $allowed = array_filter([
        CLIENT_URL,
        getenv('WEBSITE_URL') ?: '',
        'http://localhost:5173',
        'http://localhost:8080',
    ]);
    if (in_array($origin, $allowed, true)) return true;

    $host = strtolower(parse_url($origin, PHP_URL_HOST) ?: '');
    // Platform domains: crea8ivmedia.com + any subdomain (clinic., app., etc.)
    if ($host === 'crea8ivmedia.com' || str_ends_with($host, '.crea8ivmedia.com')) return true;
    // Legacy SaaS domain, kept during transition
    if ($host === 'crea8ivpatientflow.com' || str_ends_with($host, '.crea8ivpatientflow.com')) return true;

    // White-label: any domain a clinic registered as its customDomain, OR the
    // parent of that custom domain — so the clinic's main marketing site
    // (e.g. thesmilexperts.com / www.) can embed its booking widget, which
    // talks to the API as portal.thesmilexperts.com.
    try {
        $db = DB::getConnection();
        $bare = preg_replace('/^www\./', '', strtolower($host));
        $stmt = $db->prepare("SELECT 1 FROM Clinic WHERE customDomain IS NOT NULL AND (LOWER(customDomain) = ? OR LOWER(customDomain) LIKE ?) LIMIT 1");
        $stmt->execute([$bare, '%.' . $bare]);
        if ($stmt->fetchColumn()) return true;
    } catch (Exception $e) {
        // DB unavailable: fall through to deny (headers still sent below)
    }
    return false;
}

$request_origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (cors_origin_allowed($request_origin)) {
    header("Access-Control-Allow-Origin: $request_origin");
    header('Vary: Origin');
} else {
    header('Access-Control-Allow-Origin: ' . CLIENT_URL);
}
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Extract path
$request_uri = $_SERVER['REQUEST_URI'] ?? '';
$script_name = $_SERVER['SCRIPT_NAME'] ?? '';

// If path starts with script name (e.g. /api/index.php/api/v1/auth/login), clean it
$path = parse_url($request_uri, PHP_URL_PATH);
$script_dir = dirname($script_name);

if ($script_dir !== '/' && strpos($path, $script_dir) === 0) {
    $path = substr($path, strlen($script_dir));
}
// Strip index.php if present
if (strpos($path, '/index.php') === 0) {
    $path = substr($path, 10);
}
$path = trim($path, '/');

// Method
$method = $_SERVER['REQUEST_METHOD'];

// Parse input body
$input = [];
if ($method === 'POST' || $method === 'PUT' || $method === 'PATCH') {
    $raw_input = file_get_contents('php://input');
    // Preserve the exact bytes for providers (such as Meta) that sign webhook
    // payloads. Re-encoding decoded JSON would produce a different signature.
    $GLOBALS['request_raw_input'] = $raw_input;
    if (!empty($raw_input)) {
        $input = json_decode($raw_input, true) ?: [];
    }
    // Merge post parameters for multipart/form-data support
    $input = array_merge($input, $_POST);
}

// Authentication check middleware
function check_auth() {
    $headers = getallheaders();
    $auth_header = $headers['Authorization'] ?? $headers['authorization'] ?? '';

    if (empty($auth_header) || strpos($auth_header, 'Bearer ') !== 0) {
        send_error('No token provided', 401);
    }

    $token = substr($auth_header, 7);
    try {
        $user = jwt_verify_access($token);
        return $user;
    } catch (Exception $e) {
        send_error('Invalid or expired token', 401);
    }
}

// Tenant guard: clinic routes need an active (or trial/grace) clinic.
// Superadmin tokens are platform-level and never touch tenant data directly.
function require_active_tenant($user) {
    if (($user['role'] ?? '') === 'superadmin') {
        send_error('Platform admin tokens cannot access clinic routes', 403);
    }
    if (($user['role'] ?? '') === 'client') {
        send_error('Patient portal tokens cannot access clinic staff routes', 403);
    }
    $clinicId = $user['clinicId'] ?? '';
    if ($clinicId === '') {
        send_error('Invalid token', 401);
    }
    $db = DB::getConnection();
    $stmt = $db->prepare("SELECT status FROM Clinic WHERE id = ?");
    $stmt->execute([$clinicId]);
    $status = $stmt->fetchColumn();
    if ($status === false) {
        send_error('Clinic not found', 401);
    }
    if (!in_array($status, ['active', 'trial', 'grace'], true)) {
        send_error('Your subscription is not active. Please contact support to renew.', 402, [
            'code' => 'subscription_inactive',
            'clinicStatus' => $status,
        ]);
    }

    $stmt = $db->prepare("SELECT isActive FROM User WHERE id = ? AND clinicId = ?");
    $stmt->execute([$user['id'] ?? '', $clinicId]);
    $isActive = $stmt->fetchColumn();
    if ($isActive === false || !intval($isActive)) {
        send_error('User inactive', 401);
    }
}

function require_superadmin($user) {
    if (($user['role'] ?? '') !== 'superadmin') {
        send_error('Forbidden', 403);
    }
}

// Package gate: block API access to a module the clinic's package doesn't include
// (so AI-tier endpoints 403 for Core clinics, matching the hidden navigation).
function require_package_feature($user, $path) {
    $feature = pf_feature_for_path($path);
    if ($feature === null) return;
    $clinicId = $user['clinicId'] ?? '';
    if ($clinicId === '') return;
    require_once __DIR__ . '/services/tenantFeatureService.php';
    $db = DB::getConnection();
    $features = tenant_features_get($db, $clinicId);
    if (!tenant_feature_bool($features, $feature)) {
        send_error('This feature is not included in your plan.', 403, ['code' => 'feature_not_in_plan']);
    }
}

function normalize_clinic_role($role) {
    $value = strtolower(trim((string)$role));
    if (in_array($value, ['owner', 'admin', 'administrator'], true)) return 'owner';
    if (in_array($value, ['manager', 'clinic_manager', 'clinic manager'], true)) return 'manager';
    if (in_array($value, ['doctor', 'dentist', 'physician', 'consultant'], true)) return 'doctor';
    if (in_array($value, ['assistant', 'dental assistant', 'clinical assistant', 'staff'], true)) return 'staff';
    if (in_array($value, ['reception', 'frontdesk', 'front-desk', 'front_desk'], true)) return 'receptionist';
    return $value;
}

function require_clinic_role($user, $roles) {
    $roles = array_map('normalize_clinic_role', is_array($roles) ? $roles : [$roles]);
    if (!in_array(normalize_clinic_role($user['role'] ?? ''), $roles, true)) {
        send_error('Insufficient permissions', 403);
    }
}

function require_client_portal($user) {
    if (($user['role'] ?? '') !== 'client') {
        send_error('Patient portal token required', 403);
    }
    $clinicId = $user['clinicId'] ?? '';
    $clientId = $user['id'] ?? '';
    if ($clinicId === '' || $clientId === '') {
        send_error('Invalid token', 401);
    }
    $db = DB::getConnection();
    $stmt = $db->prepare("SELECT status FROM Clinic WHERE id = ?");
    $stmt->execute([$clinicId]);
    $status = $stmt->fetchColumn();
    if (!in_array($status, ['active', 'trial', 'grace'], true)) {
        send_error('Clinic subscription is not active.', 402, [
            'code' => 'subscription_inactive',
            'clinicStatus' => $status ?: null,
        ]);
    }
    $stmt = $db->prepare("SELECT status FROM Client WHERE id = ? AND clinicId = ?");
    $stmt->execute([$clientId, $clinicId]);
    $clientStatus = $stmt->fetchColumn();
    if ($clientStatus === false || $clientStatus === 'inactive') {
        send_error('Patient portal account inactive', 401);
    }
}

// Routing rules table
// format: [Method, Pattern, ControllerClass, ControllerAction, Guard]
// Guard: false = public | true = tenant (auth + active clinic)
//        'auth' = any authenticated user | 'admin' = superadmin only
//        array = tenant + one of the listed clinic roles
$routes = [
    // Health Check
    ['GET', '^api/v1/health$', 'StatusController', 'health', false],

    // Signed file serving (patient uploads) — auth is the HMAC signature itself
    ['GET', '^api/v1/files/([^/]+)$', 'FileController', 'serve', false],

    // Public "Live Demo" — mint a read-only session into the seeded demo clinic
    ['POST', '^api/v1/public/demo-session$', 'PublicSiteController', 'demoSession', false],
    ['GET', '^api/v1/features$', 'StatusController', 'features', true],

    // Auth Routes
    ['POST', '^api/v1/auth/register$', 'AuthController', 'register', false],
    ['POST', '^api/v1/auth/login$', 'AuthController', 'login', false],
    ['GET', '^api/v1/auth/username-availability$', 'AuthController', 'usernameAvailability', false],
    ['POST', '^api/v1/auth/refresh$', 'AuthController', 'refresh', false],
    ['POST', '^api/v1/auth/logout$', 'AuthController', 'logout', false],
    ['POST', '^api/v1/auth/logout-all$', 'AuthController', 'logoutAll', 'auth'],
    ['POST', '^api/v1/auth/forgot-password$', 'AuthController', 'forgotPassword', false],
    ['POST', '^api/v1/auth/reset-password$', 'AuthController', 'resetPassword', false],
    ['GET', '^api/v1/auth/me$', 'AuthController', 'me', 'auth'],

    // Public SaaS registration (clinic signup leads)
    ['POST', '^api/v1/public/register-clinic$', 'RegistrationController', 'register', false],

    // Platform owner (superadmin) routes
    ['GET', '^api/v1/admin/stats$', 'AdminController', 'stats', 'admin'],
    ['GET', '^api/v1/admin/platform$', 'AdminController', 'getPlatform', 'admin'],
    ['PUT', '^api/v1/admin/platform$', 'AdminController', 'updatePlatform', 'admin'],
    ['GET', '^api/v1/admin/tenants$', 'AdminController', 'listTenants', 'admin'],
    ['POST', '^api/v1/admin/tenants$', 'AdminController', 'createTenant', 'admin'],
    ['GET', '^api/v1/admin/tenants/([^/]+)$', 'AdminController', 'getTenant', 'admin'],
    ['GET', '^api/v1/admin/tenants/([^/]+)/automation$', 'AdminController', 'getTenantAutomation', 'admin'],
    ['PUT', '^api/v1/admin/tenants/([^/]+)/automation$', 'AdminController', 'updateTenantAutomation', 'admin'],
    ['POST', '^api/v1/admin/tenants/([^/]+)/activate$', 'AdminController', 'activateTenant', 'admin'],
    ['POST', '^api/v1/admin/tenants/([^/]+)/suspend$', 'AdminController', 'suspendTenant', 'admin'],
    ['POST', '^api/v1/admin/tenants/([^/]+)/extend$', 'AdminController', 'extendTenant', 'admin'],
    ['POST', '^api/v1/admin/tenants/([^/]+)/subscription$', 'AdminController', 'setSubscription', 'admin'],
    ['POST', '^api/v1/admin/tenants/([^/]+)/impersonate$', 'AdminController', 'impersonateTenant', 'admin'],
    ['POST', '^api/v1/admin/tenants/([^/]+)/owner-password$', 'AdminController', 'resetTenantOwnerPassword', 'admin'],
    ['PUT', '^api/v1/admin/tenants/([^/]+)/package$', 'AdminController', 'setPackage', 'admin'],
    ['PUT', '^api/v1/admin/tenants/([^/]+)/domain$', 'AdminController', 'setDomain', 'admin'],
    ['PUT', '^api/v1/admin/tenants/([^/]+)/domain/ssl$', 'AdminController', 'setDomainSsl', 'admin'],
    ['PUT', '^api/v1/admin/tenants/([^/]+)$', 'AdminController', 'updateTenant', 'admin'],
    ['DELETE', '^api/v1/admin/tenants/([^/]+)$', 'AdminController', 'deleteTenant', 'admin'],
    ['GET', '^api/v1/admin/leads$', 'AdminController', 'listLeads', 'admin'],
    ['POST', '^api/v1/admin/leads$', 'AdminController', 'createLead', 'admin'],
    ['PUT', '^api/v1/admin/leads/([^/]+)$', 'AdminController', 'updateLead', 'admin'],
    ['POST', '^api/v1/admin/leads/([^/]+)/convert$', 'AdminController', 'convertLead', 'admin'],
    ['GET', '^api/v1/admin/payments$', 'AdminController', 'listPayments', 'admin'],
    ['POST', '^api/v1/admin/payments$', 'AdminController', 'recordPayment', 'admin'],
    ['PUT', '^api/v1/admin/payments/([^/]+)/verify$', 'AdminController', 'verifyPayment', 'admin'],
    ['PUT', '^api/v1/admin/payments/([^/]+)/reject$', 'AdminController', 'rejectPayment', 'admin'],
    ['GET', '^api/v1/admin/tickets$', 'AdminController', 'listTickets', 'admin'],
    ['GET', '^api/v1/admin/tickets/([^/]+)$', 'AdminController', 'getTicket', 'admin'],
    ['POST', '^api/v1/admin/tickets/([^/]+)/reply$', 'AdminController', 'replyTicket', 'admin'],
    ['PUT', '^api/v1/admin/tickets/([^/]+)$', 'AdminController', 'updateTicket', 'admin'],

    // Self-service custom domain (clinic owner)
    ['GET', '^api/v1/settings/domain$', 'DomainController', 'get', ['owner', 'manager']],
    ['PUT', '^api/v1/settings/domain$', 'DomainController', 'set', ['owner', 'manager']],
    ['POST', '^api/v1/settings/domain/verify$', 'DomainController', 'verify', ['owner', 'manager']],
    ['DELETE', '^api/v1/settings/domain$', 'DomainController', 'remove', ['owner', 'manager']],

    // Clinic-side support tickets
    ['GET', '^api/v1/support/tickets$', 'SupportController', 'list', true],
    ['POST', '^api/v1/support/tickets$', 'SupportController', 'create', true],
    ['GET', '^api/v1/support/tickets/([^/]+)$', 'SupportController', 'thread', true],
    ['POST', '^api/v1/support/tickets/([^/]+)/reply$', 'SupportController', 'reply', true],

    // Dynamic Settings and Public Website Routes
    ['GET', '^api/v1/settings/public-site$', 'PublicSiteController', 'getSettings', ['owner', 'manager']],
    ['PUT', '^api/v1/settings/public-site$', 'PublicSiteController', 'updateSettings', ['owner', 'manager']],
    ['GET', '^api/v1/public/branding$', 'PublicSiteController', 'branding', false],
    ['GET', '^api/v1/public/platform-branding$', 'PublicSiteController', 'platformBranding', false],
    ['GET', '^api/v1/public/site$', 'PublicSiteController', 'getSite', false],
    ['GET', '^api/v1/public/availability$', 'PublicSiteController', 'availability', false],
    ['POST', '^api/v1/public/book$', 'PublicSiteController', 'book', false],

    // Users Routes
    ['GET', '^api/v1/users$', 'UserController', 'list', ['owner']],
    ['POST', '^api/v1/users$', 'UserController', 'create', ['owner']],
    ['POST', '^api/v1/users/([^/]+)/reset-password$', 'UserController', 'resetPassword', ['owner']],
    ['PUT', '^api/v1/users/([^/]+)$', 'UserController', 'update', ['owner']],
    ['PATCH', '^api/v1/users/([^/]+)$', 'UserController', 'update', ['owner']],
    ['DELETE', '^api/v1/users/([^/]+)$', 'UserController', 'remove', ['owner']],

    // Prescriptions Routes
    ['GET', '^api/v1/prescriptions$', 'PrescriptionController', 'list', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['POST', '^api/v1/prescriptions$', 'PrescriptionController', 'create', ['owner', 'manager', 'doctor', 'therapist']],
    ['GET', '^api/v1/prescriptions/([^/]+)/pdf$', 'PrescriptionController', 'getPDF', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['GET', '^api/v1/prescriptions/([^/]+)$', 'PrescriptionController', 'getById', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['PUT', '^api/v1/prescriptions/([^/]+)$', 'PrescriptionController', 'update', ['owner', 'manager', 'doctor', 'therapist']],
    ['DELETE', '^api/v1/prescriptions/([^/]+)$', 'PrescriptionController', 'remove', ['owner', 'manager', 'doctor']],

    // Clients Routes
    ['GET', '^api/v1/clients$', 'ClientController', 'list', ['owner', 'manager', 'doctor', 'therapist', 'accountant', 'receptionist', 'staff']],
    ['POST', '^api/v1/clients$', 'ClientController', 'create', ['owner', 'manager', 'receptionist']],
    ['GET', '^api/v1/clients/([^/]+)/appointments$', 'ClientController', 'getAppointments', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['GET', '^api/v1/clients/([^/]+)/packages$', 'ClientController', 'getPackages', ['owner', 'manager', 'accountant', 'receptionist']],
    ['POST', '^api/v1/clients/([^/]+)/portal-credentials$', 'ClientController', 'generatePortalCredentials', ['owner', 'manager', 'receptionist']],
    ['GET', '^api/v1/clients/([^/]+)$', 'ClientController', 'getById', ['owner', 'manager', 'doctor', 'therapist', 'accountant', 'receptionist', 'staff']],
    ['PUT', '^api/v1/clients/([^/]+)$', 'ClientController', 'update', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['DELETE', '^api/v1/clients/([^/]+)$', 'ClientController', 'remove', ['owner', 'manager', 'receptionist']],
    ['GET', '^api/v1/clients/([^/]+)/treatment-plan$', 'TreatmentController', 'list', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['POST', '^api/v1/clients/([^/]+)/treatment-plan$', 'TreatmentController', 'create', ['owner', 'manager', 'doctor', 'therapist']],
    ['PUT', '^api/v1/treatment-plan/([^/]+)$', 'TreatmentController', 'update', ['owner', 'manager', 'doctor', 'therapist']],
    ['DELETE', '^api/v1/treatment-plan/([^/]+)$', 'TreatmentController', 'remove', ['owner', 'manager', 'doctor', 'therapist']],
    ['GET', '^api/v1/clients/([^/]+)/treatment-details$', 'TreatmentController', 'details', ['owner', 'manager', 'doctor', 'therapist', 'receptionist', 'staff']],
    ['POST', '^api/v1/clients/([^/]+)/treatment-details$', 'TreatmentController', 'createDetail', ['owner', 'manager', 'doctor', 'therapist']],
    ['PUT', '^api/v1/treatment-details/([^/]+)$', 'TreatmentController', 'updateDetail', ['owner', 'manager', 'doctor', 'therapist']],
    ['DELETE', '^api/v1/treatment-details/([^/]+)$', 'TreatmentController', 'removeDetail', ['owner', 'manager', 'doctor', 'therapist']],
    ['GET', '^api/v1/clients/([^/]+)/treatment-timeline$', 'TreatmentController', 'timeline', ['owner', 'manager', 'doctor', 'therapist', 'receptionist', 'staff']],
    ['GET', '^api/v1/lab$', 'LabController', 'list', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['POST', '^api/v1/lab$', 'LabController', 'create', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['PUT', '^api/v1/lab/([^/]+)$', 'LabController', 'update', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['DELETE', '^api/v1/lab/([^/]+)$', 'LabController', 'remove', ['owner', 'manager', 'doctor', 'therapist']],

    // Appointments Routes
    ['GET', '^api/v1/appointments/today$', 'AppointmentController', 'getToday', ['owner', 'manager', 'doctor', 'therapist', 'receptionist', 'staff']],
    ['GET', '^api/v1/appointments/conflicts$', 'AppointmentController', 'getConflicts', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['GET', '^api/v1/appointments$', 'AppointmentController', 'list', ['owner', 'manager', 'doctor', 'therapist', 'receptionist', 'staff']],
    ['POST', '^api/v1/appointments$', 'AppointmentController', 'create', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['GET', '^api/v1/appointments/([^/]+)$', 'AppointmentController', 'getById', ['owner', 'manager', 'doctor', 'therapist', 'receptionist', 'staff']],
    ['PUT', '^api/v1/appointments/([^/]+)$', 'AppointmentController', 'update', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['DELETE', '^api/v1/appointments/([^/]+)$', 'AppointmentController', 'remove', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['PUT', '^api/v1/appointments/([^/]+)/cancel$', 'AppointmentController', 'cancel', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['PUT', '^api/v1/appointments/([^/]+)/reschedule$', 'AppointmentController', 'reschedule', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['POST', '^api/v1/appointments/([^/]+)/checkin-token$', 'AppointmentController', 'issueCheckinToken', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['POST', '^api/v1/appointments/([^/]+)/checkin-token/revoke$', 'AppointmentController', 'revokeCheckinToken', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['POST', '^api/v1/appointments/checkin/scan$', 'AppointmentController', 'scanCheckinToken', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['PUT', '^api/v1/appointments/([^/]+)/checkin$', 'AppointmentController', 'checkIn', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],

    // Staff Routes
    ['GET', '^api/v1/staff$', 'StaffController', 'list', ['owner', 'manager', 'doctor', 'therapist', 'receptionist', 'staff']],
    ['POST', '^api/v1/staff$', 'StaffController', 'create', ['owner', 'manager']],
    ['GET', '^api/v1/staff/([^/]+)/performance$', 'StaffController', 'getPerformance', ['owner', 'manager']],
    ['GET', '^api/v1/staff/([^/]+)$', 'StaffController', 'getById', ['owner', 'manager', 'doctor', 'therapist', 'receptionist', 'staff']],
    ['PUT', '^api/v1/staff/([^/]+)$', 'StaffController', 'update', ['owner', 'manager']],
    ['DELETE', '^api/v1/staff/([^/]+)$', 'StaffController', 'remove', ['owner', 'manager']],

    // Services Routes
    ['GET', '^api/v1/services$', 'ServiceController', 'list', ['owner', 'manager', 'doctor', 'therapist', 'receptionist', 'staff']],
    ['POST', '^api/v1/services$', 'ServiceController', 'create', ['owner', 'manager']],
    ['GET', '^api/v1/services/([^/]+)$', 'ServiceController', 'getById', ['owner', 'manager', 'doctor', 'therapist', 'receptionist', 'staff']],
    ['PUT', '^api/v1/services/([^/]+)$', 'ServiceController', 'update', ['owner', 'manager']],
    ['DELETE', '^api/v1/services/([^/]+)$', 'ServiceController', 'remove', ['owner', 'manager']],

    // Packages Routes
    ['GET', '^api/v1/packages$', 'PackageController', 'list', ['owner', 'manager', 'accountant', 'receptionist']],
    ['POST', '^api/v1/packages$', 'PackageController', 'create', ['owner', 'manager']],
    ['PUT', '^api/v1/packages/([^/]+)$', 'PackageController', 'update', ['owner', 'manager']],
    ['DELETE', '^api/v1/packages/([^/]+)$', 'PackageController', 'remove', ['owner', 'manager']],
    ['POST', '^api/v1/packages/([^/]+)/purchase$', 'PackageController', 'purchase', ['owner', 'manager', 'accountant', 'receptionist']],
    ['GET', '^api/v1/packages/client/([^/]+)$', 'PackageController', 'getClientPackages', ['owner', 'manager', 'accountant', 'receptionist']],

    // Invoices Routes
    ['GET', '^api/v1/invoices$', 'InvoiceController', 'list', ['owner', 'manager', 'accountant', 'receptionist']],
    ['POST', '^api/v1/invoices$', 'InvoiceController', 'create', ['owner', 'manager', 'accountant', 'receptionist']],
    ['PUT', '^api/v1/invoices/([^/]+)/paid$', 'InvoiceController', 'markPaid', ['owner', 'manager', 'accountant', 'receptionist']],
    ['PUT', '^api/v1/invoices/([^/]+)/refund$', 'InvoiceController', 'refund', ['owner', 'manager', 'accountant']],
    ['GET', '^api/v1/invoices/([^/]+)/pdf$', 'InvoiceController', 'getPDF', ['owner', 'manager', 'accountant', 'receptionist']],
    ['GET', '^api/v1/invoices/([^/]+)$', 'InvoiceController', 'getById', ['owner', 'manager', 'accountant', 'receptionist']],
    ['PUT', '^api/v1/invoices/([^/]+)$', 'InvoiceController', 'update', ['owner', 'manager', 'accountant', 'receptionist']],
    ['DELETE', '^api/v1/invoices/([^/]+)$', 'InvoiceController', 'remove', ['owner', 'manager', 'accountant']],

    // Inventory Routes
    ['GET', '^api/v1/inventory/alerts/low-stock$', 'InventoryController', 'getLowStock', ['owner', 'manager', 'doctor', 'therapist', 'receptionist', 'staff']],
    ['GET', '^api/v1/inventory$', 'InventoryController', 'list', ['owner', 'manager', 'doctor', 'therapist', 'receptionist', 'staff']],
    ['POST', '^api/v1/inventory$', 'InventoryController', 'create', ['owner', 'manager']],
    ['GET', '^api/v1/inventory/([^/]+)$', 'InventoryController', 'getById', ['owner', 'manager', 'doctor', 'therapist', 'receptionist', 'staff']],
    ['PUT', '^api/v1/inventory/([^/]+)$', 'InventoryController', 'update', ['owner', 'manager']],
    ['POST', '^api/v1/inventory/([^/]+)/stock$', 'InventoryController', 'adjustStock', ['owner', 'manager', 'doctor', 'therapist', 'staff']],

    // Financials Routes
    ['GET', '^api/v1/financials/summary$', 'FinancialController', 'getSummary', ['owner', 'manager', 'accountant']],
    ['GET', '^api/v1/financials/monthly$', 'FinancialController', 'getMonthly', ['owner', 'manager', 'accountant']],
    ['GET', '^api/v1/financials/transactions$', 'FinancialController', 'getTransactions', ['owner', 'manager', 'accountant']],
    ['GET', '^api/v1/financials/profitability$', 'FinancialController', 'getProfitability', ['owner', 'manager', 'accountant']],
    ['GET', '^api/v1/invoices/([^/]+)/procedure-costs$', 'FinancialController', 'getProcedureCosts', ['owner', 'manager', 'accountant']],
    ['PUT', '^api/v1/invoices/([^/]+)/procedure-costs$', 'FinancialController', 'saveProcedureCost', ['owner', 'manager', 'accountant']],

    // Expenses Routes
    ['GET', '^api/v1/expenses/categories$', 'ExpenseController', 'categories', ['owner', 'manager', 'accountant']],
    ['POST', '^api/v1/expenses/categories$', 'ExpenseController', 'createCategory', ['owner', 'manager', 'accountant']],
    ['PUT', '^api/v1/expenses/categories/([^/]+)$', 'ExpenseController', 'updateCategory', ['owner', 'manager', 'accountant']],
    ['DELETE', '^api/v1/expenses/categories/([^/]+)$', 'ExpenseController', 'removeCategory', ['owner', 'manager', 'accountant']],
    ['GET', '^api/v1/expenses$', 'ExpenseController', 'list', ['owner', 'manager', 'accountant']],
    ['POST', '^api/v1/expenses$', 'ExpenseController', 'create', ['owner', 'manager', 'accountant']],
    ['GET', '^api/v1/expenses/([^/]+)$', 'ExpenseController', 'get', ['owner', 'manager', 'accountant']],
    ['PUT', '^api/v1/expenses/([^/]+)$', 'ExpenseController', 'update', ['owner', 'manager', 'accountant']],
    ['DELETE', '^api/v1/expenses/([^/]+)$', 'ExpenseController', 'remove', ['owner', 'manager', 'accountant']],

    // AI Hub Routes
    ['GET', '^api/v1/ai/overview$', 'AIHubController', 'overview', ['owner', 'manager']],
    ['PUT', '^api/v1/ai/providers/([^/]+)$', 'AIHubController', 'saveProvider', ['owner', 'manager']],

    // AI Receptionist Routes (AppointmentFlow AI plan only — gated via api/v1/ai prefix)
    ['GET', '^api/v1/ai-receptionist/persona$', 'AIReceptionistController', 'getPersona', ['owner', 'manager']],
    ['PUT', '^api/v1/ai-receptionist/persona$', 'AIReceptionistController', 'savePersona', ['owner', 'manager']],
    ['GET', '^api/v1/ai-receptionist/knowledge$', 'AIReceptionistController', 'listKnowledge', ['owner', 'manager']],
    ['POST', '^api/v1/ai-receptionist/knowledge$', 'AIReceptionistController', 'createKnowledge', ['owner', 'manager']],
    ['PUT', '^api/v1/ai-receptionist/knowledge/([^/]+)$', 'AIReceptionistController', 'updateKnowledge', ['owner', 'manager']],
    ['DELETE', '^api/v1/ai-receptionist/knowledge/([^/]+)$', 'AIReceptionistController', 'deleteKnowledge', ['owner', 'manager']],
    ['GET', '^api/v1/ai-receptionist/memory$', 'AIReceptionistController', 'listMemory', ['owner', 'manager']],
    ['DELETE', '^api/v1/ai-receptionist/memory/([^/]+)$', 'AIReceptionistController', 'deleteMemory', ['owner', 'manager']],
    ['POST', '^api/v1/ai-receptionist/preview$', 'AIReceptionistController', 'preview', ['owner', 'manager']],
    ['POST', '^api/v1/ai-receptionist/simulate$', 'AIReceptionistController', 'simulate', ['owner', 'manager']],

    // Meta Lead Center Routes
    ['GET', '^api/v1/meta/settings$', 'MetaLeadController', 'settings', ['owner', 'manager']],
    ['PUT', '^api/v1/meta/settings$', 'MetaLeadController', 'saveSettings', ['owner', 'manager']],
    ['GET', '^api/v1/meta/leads$', 'MetaLeadController', 'list', ['owner', 'manager', 'receptionist']],
    ['POST', '^api/v1/meta/leads$', 'MetaLeadController', 'create', ['owner', 'manager', 'receptionist']],
    ['PUT', '^api/v1/meta/leads/([^/]+)$', 'MetaLeadController', 'update', ['owner', 'manager', 'receptionist']],
    ['DELETE', '^api/v1/meta/leads/([^/]+)$', 'MetaLeadController', 'remove', ['owner', 'manager']],
    ['POST', '^api/v1/meta/leads/([^/]+)/convert$', 'MetaLeadController', 'convert', ['owner', 'manager', 'receptionist']],

    // Import/Migration Routes
    ['GET', '^api/v1/import/jobs$', 'ImportController', 'list', ['owner', 'manager']],
    ['POST', '^api/v1/import/jobs$', 'ImportController', 'create', ['owner', 'manager']],
    ['PUT', '^api/v1/import/jobs/([^/]+)$', 'ImportController', 'update', ['owner', 'manager']],
    ['DELETE', '^api/v1/import/jobs/([^/]+)$', 'ImportController', 'remove', ['owner', 'manager']],

    // Feedback Routes
    ['GET', '^api/v1/feedback/summary$', 'FeedbackController', 'getSummary', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['GET', '^api/v1/feedback$', 'FeedbackController', 'list', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['POST', '^api/v1/feedback$', 'FeedbackController', 'create', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['PUT', '^api/v1/feedback/([^/]+)$', 'FeedbackController', 'update', ['owner', 'manager']],
    ['DELETE', '^api/v1/feedback/([^/]+)$', 'FeedbackController', 'remove', ['owner', 'manager']],

    // Campaign/Marketing Routes
    ['GET', '^api/v1/campaigns$', 'MarketingController', 'list', ['owner', 'manager', 'receptionist']],
    ['POST', '^api/v1/campaigns$', 'MarketingController', 'create', ['owner', 'manager']],
    ['GET', '^api/v1/campaigns/([^/]+)$', 'MarketingController', 'getById', ['owner', 'manager', 'receptionist']],
    ['PUT', '^api/v1/campaigns/([^/]+)$', 'MarketingController', 'update', ['owner', 'manager']],
    ['DELETE', '^api/v1/campaigns/([^/]+)$', 'MarketingController', 'remove', ['owner', 'manager']],
    ['POST', '^api/v1/campaigns/([^/]+)/send$', 'MarketingController', 'send', ['owner', 'manager']],

    // Gallery Routes
    ['GET', '^api/v1/gallery/([^/]+)$', 'GalleryController', 'list', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['POST', '^api/v1/gallery/([^/]+)$', 'GalleryController', 'upload', ['owner', 'manager', 'doctor', 'therapist', 'receptionist']],
    ['DELETE', '^api/v1/gallery/([^/]+)$', 'GalleryController', 'remove', ['owner', 'manager', 'doctor', 'therapist']],

    // Starter Manual Outreach Routes (click-to-WhatsApp, no WhatsApp API sending)
    ['GET', '^api/v1/manual-outreach/logs$', 'ManualOutreachController', 'list', ['owner', 'manager', 'doctor', 'therapist', 'receptionist', 'staff']],
    ['POST', '^api/v1/manual-outreach/logs$', 'ManualOutreachController', 'create', ['owner', 'manager', 'doctor', 'therapist', 'receptionist', 'staff']],

    // Branches Routes
    ['GET', '^api/v1/branches$', 'BranchController', 'list', ['owner', 'manager', 'doctor', 'therapist', 'receptionist', 'staff']],
    ['POST', '^api/v1/branches$', 'BranchController', 'create', ['owner', 'manager']],
    ['PUT', '^api/v1/branches/([^/]+)$', 'BranchController', 'update', ['owner', 'manager']],
    ['DELETE', '^api/v1/branches/([^/]+)$', 'BranchController', 'remove', ['owner', 'manager']],

    // Audit Routes
    ['GET', '^api/v1/audit$', 'AuditController', 'list', ['owner', 'manager']],

    // WhatsApp Patient Engagement Center
    ['GET', '^api/v1/whatsapp/webhook$', 'WhatsAppController', 'webhookVerify', false],
    ['POST', '^api/v1/whatsapp/webhook$', 'WhatsAppController', 'webhook', false],
    ['GET', '^api/v1/whatsapp/dashboard$', 'WhatsAppController', 'dashboard', ['owner', 'manager', 'receptionist']],
    ['GET', '^api/v1/whatsapp/health$', 'WhatsAppController', 'health', ['owner', 'manager']],
    ['POST', '^api/v1/whatsapp/test-message$', 'WhatsAppController', 'testMessage', ['owner', 'manager']],
    ['POST', '^api/v1/whatsapp/templates/sync$', 'WhatsAppController', 'syncTemplates', ['owner', 'manager']],
    ['GET', '^api/v1/whatsapp/diagnostics$', 'WhatsAppController', 'diagnostics', ['owner', 'manager']],
    ['POST', '^api/v1/whatsapp/queue/retry$', 'WhatsAppController', 'retryQueue', ['owner', 'manager']],
    ['GET', '^api/v1/whatsapp/media$', 'WhatsAppController', 'media', ['owner', 'manager', 'receptionist']],
    ['GET', '^api/v1/whatsapp/branches$', 'WhatsAppController', 'branches', ['owner', 'manager', 'receptionist']],
    ['PUT', '^api/v1/whatsapp/branches/([^/]+)$', 'WhatsAppController', 'updateBranch', ['owner', 'manager']],
    ['GET', '^api/v1/whatsapp/contacts$', 'WhatsAppController', 'contacts', ['owner', 'manager', 'receptionist']],
    ['GET', '^api/v1/whatsapp/contacts/([^/]+)$', 'WhatsAppController', 'profile', ['owner', 'manager', 'receptionist']],
    ['GET', '^api/v1/whatsapp/conversations/([^/]+)$', 'WhatsAppController', 'messages', ['owner', 'manager', 'receptionist']],
    ['POST', '^api/v1/whatsapp/conversations/([^/]+)/ai-suggest$', 'WhatsAppController', 'aiSuggest', ['owner', 'manager', 'receptionist']],
    ['POST', '^api/v1/whatsapp/conversations/([^/]+)/messages$', 'WhatsAppController', 'send', ['owner', 'manager', 'receptionist']],
    ['POST', '^api/v1/whatsapp/conversations/([^/]+)/templates$', 'WhatsAppController', 'sendTemplate', ['owner', 'manager', 'receptionist']],
    ['PUT', '^api/v1/whatsapp/conversations/([^/]+)$', 'WhatsAppController', 'updateConversation', ['owner', 'manager', 'receptionist']],
    ['PUT', '^api/v1/whatsapp/contacts/([^/]+)/consent$', 'WhatsAppController', 'updateConsent', ['owner', 'manager', 'receptionist']],
    ['GET', '^api/v1/whatsapp/templates$', 'WhatsAppController', 'templates', ['owner', 'manager']],
    ['POST', '^api/v1/whatsapp/templates$', 'WhatsAppController', 'createTemplate', ['owner', 'manager']],
    ['GET', '^api/v1/whatsapp/automations$', 'WhatsAppController', 'automations', ['owner', 'manager']],
    ['POST', '^api/v1/whatsapp/automations$', 'WhatsAppController', 'createAutomation', ['owner', 'manager']],
    ['POST', '^api/v1/whatsapp/automations/run$', 'WhatsAppController', 'runAutomations', ['owner', 'manager']],
    ['PUT', '^api/v1/whatsapp/automations/([^/]+)/toggle$', 'WhatsAppController', 'toggleAutomation', ['owner', 'manager']],
    ['GET', '^api/v1/whatsapp/campaigns$', 'WhatsAppController', 'campaigns', ['owner', 'manager']],
    ['POST', '^api/v1/whatsapp/campaigns$', 'WhatsAppController', 'createCampaign', ['owner', 'manager']],
    ['POST', '^api/v1/whatsapp/campaigns/([^/]+)/launch$', 'WhatsAppController', 'launchCampaign', ['owner', 'manager']],
    ['GET', '^api/v1/whatsapp/segments$', 'WhatsAppController', 'segments', ['owner', 'manager']],
    ['GET', '^api/v1/whatsapp/settings$', 'WhatsAppController', 'settingsGet', ['owner', 'manager']],
    ['PUT', '^api/v1/whatsapp/settings$', 'WhatsAppController', 'settingsSave', ['owner', 'manager']],

    // Notifications Routes
    ['GET', '^api/v1/notifications$', 'NotificationController', 'list', true],
    ['POST', '^api/v1/notifications/([^/]+)/read$', 'NotificationController', 'markRead', true],
    ['POST', '^api/v1/notifications/read-all$', 'NotificationController', 'markAllRead', true],

    // Patient Portal Client Routes
    ['POST', '^api/v1/portal/login$', 'PortalController', 'login', false],
    ['GET', '^api/v1/portal/appointments$', 'PortalController', 'getMyAppointments', 'client'],
    ['POST', '^api/v1/portal/appointments$', 'PortalController', 'bookAppointment', 'client'],
    ['GET', '^api/v1/portal/invoices$', 'PortalController', 'getMyInvoices', 'client'],
    ['GET', '^api/v1/portal/invoices/([^/]+)/download$', 'PortalController', 'downloadInvoice', 'client'],
    ['GET', '^api/v1/portal/packages$', 'PortalController', 'getMyPackages', 'client'],
    ['POST', '^api/v1/portal/feedback$', 'PortalController', 'submitFeedback', 'client'],
];

// Perform Route Match
$matched = false;
foreach ($routes as $route) {
    list($route_method, $pattern, $controllerName, $actionName, $guard) = $route;

    $method_matched = ($method === $route_method) || ($route_method === 'PUT' && $method === 'PATCH');
    if ($method_matched && preg_match('#' . $pattern . '#', $path, $matches)) {
        $matched = true;
        array_shift($matches); // Remove the full path match

        $user = null;
        if ($guard !== false) {
            $user = check_auth();
            if ($guard === 'admin') {
                require_superadmin($user);
            } elseif ($guard === 'client') {
                require_client_portal($user);
            } elseif (is_array($guard)) {
                require_active_tenant($user);
                require_clinic_role($user, $guard);
                require_package_feature($user, $path);
            } elseif ($guard === true) {
                require_active_tenant($user);
                require_package_feature($user, $path);
            }
            // 'auth' = any valid token, no further checks

            // Public read-only demo: a demo session (demo:true claim) may READ
            // everything but never mutate — keeps the public demo pristine.
            if ($user && !empty($user['demo']) && !in_array($method, ['GET', 'OPTIONS'], true)
                && strpos($path, 'api/v1/auth') !== 0) {
                send_error('This is a read-only live demo. Sign up to create or change data.', 403, ['code' => 'demo_readonly']);
            }
        }

        $controllerFile = __DIR__ . '/controllers/' . $controllerName . '.php';
        if (file_exists($controllerFile)) {
            require_once $controllerFile;
            $controller = new $controllerName();
            
            try {
                $controller->$actionName($input, $user, ...$matches);
            } catch (Throwable $e) {
                error_log("$controllerName::$actionName failed: " . $e->getMessage());
                $message = APP_ENV === 'development' ? $e->getMessage() : 'Internal server error';
                send_error($message, 500);
            }
        } else {
            send_error("Controller file $controllerName not found", 500);
        }
        exit;
    }
}

if (!$matched) {
    send_error("Route not found: $method /$path", 404);
}
