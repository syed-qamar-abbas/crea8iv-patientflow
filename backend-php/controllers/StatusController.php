<?php
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../services/tenantFeatureService.php';
require_once __DIR__ . '/../services/packageService.php';
require_once __DIR__ . '/../services/clinicalSafetyPolicyService.php';

class StatusController {
    public function health($input, $user) {
        send_json([
            'status' => 'ok',
            'timestamp' => date('Y-m-d\TH:i:s\Z')
        ]);
    }

    public function features($input, $user) {
        $db = DB::getConnection();
        $features = tenant_features_get($db, $user['clinicId']);
        $clinicalSafety = pf_clinical_safety_policy($db, $user['clinicId']);
        $industryTemplate = industry_template_get($db, $features['industryTemplate'] ?? INDUSTRY_TEMPLATE_DEFAULT);
        $stmt = $db->prepare("SELECT id, name, tagline, logo, primaryColor, secondaryColor, font, website FROM Clinic WHERE id = ?");
        $stmt->execute([$user['clinicId']]);
        $clinic = $stmt->fetch() ?: null;
        $packageKey = pf_package_get($db, $user['clinicId']);
        $package = pf_packages()[$packageKey] ?? pf_packages()['core'];
        $stmt = $db->prepare("SELECT id, billingCycle, amountPKR, startsAt, expiresAt, status FROM Subscription WHERE clinicId = ? AND status = 'active' ORDER BY expiresAt DESC LIMIT 1");
        $stmt->execute([$user['clinicId']]);
        $subscription = $stmt->fetch() ?: null;
        if ($subscription) {
            $subscription['amountPKR'] = (float)$subscription['amountPKR'];
            $subscription['packageKey'] = $packageKey;
            $subscription['packageName'] = $package['name'] ?? 'Starter';
            $subscription['packagePricePKR'] = (float)($package['pricePKR'] ?? 0);
        }
        send_json([
            'marketingEnabled' => !empty($features['marketingEnabled']),
            'metaLeadsEnabled' => !empty($features['metaLeadsEnabled']),
            'importsEnabled' => !empty($features['importsEnabled']),
            'whatsappEnabled' => !empty($features['whatsappEnabled']),
            'whatsappMarketingEnabled' => !empty($features['whatsappMarketingEnabled']),
            'whatsappAutomationEnabled' => !empty($features['whatsappAutomationEnabled']),
            'aiEnabled' => !empty($features['aiEnabled']),
            'aiAutoReplyEnabled' => !empty($features['aiAutoReplyEnabled']),
            'aiHumanApprovalRequired' => !empty($features['aiHumanApprovalRequired']),
            'monthlyAiTokenLimit' => intval($features['monthlyAiTokenLimit'] ?? 0),
            'monthlyWhatsAppLimit' => intval($features['monthlyWhatsAppLimit'] ?? 0),
            'industryTemplate' => $features['industryTemplate'] ?? INDUSTRY_TEMPLATE_DEFAULT,
            'industryConfig' => $industryTemplate,
            'operatingMode' => $clinicalSafety['operatingMode'],
            'clinicalRecordEnabled' => $clinicalSafety['clinicalRecordEnabled'],
            'treatmentProcedureEntryEnabled' => $clinicalSafety['treatmentProcedureEntryEnabled'],
            'medicalHistoryEntryEnabled' => $clinicalSafety['medicalHistoryEntryEnabled'],
            'patientImagePublicationEnabled' => $clinicalSafety['patientImagePublicationEnabled'],
            'aiClinicalAdviceEnabled' => $clinicalSafety['aiClinicalAdviceEnabled'],
            'clinicalPolicyVersion' => $clinicalSafety['clinicalPolicyVersion'],
            'package' => [
                'key' => $packageKey,
                'name' => $package['name'] ?? 'Starter',
                'pricePKR' => (float)($package['pricePKR'] ?? 0),
                'annualPricePKR' => isset($package['annualPricePKR']) ? (float)$package['annualPricePKR'] : null,
                'annualNote' => $package['annualNote'] ?? null,
            ],
            'subscription' => $subscription,
            'clinic' => $clinic,
        ]);
    }
}
