<?php
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/tenantFeatureService.php';

const PF_OPERATING_MODE_OPERATIONS_ONLY = 'operations_only';
const PF_CLINICAL_POLICY_VERSION = 'operations-v1';

/**
 * Phase A is deliberately fail-closed. Database values are retained for an
 * eventual governed rollout, but cannot enable clinical capabilities yet.
 */
function pf_clinical_safety_policy($db, $clinicId) {
    tenant_features_get($db, $clinicId);

    return [
        'operatingMode' => PF_OPERATING_MODE_OPERATIONS_ONLY,
        'clinicalRecordEnabled' => false,
        'treatmentProcedureEntryEnabled' => false,
        'medicalHistoryEntryEnabled' => false,
        'patientImagePublicationEnabled' => false,
        'aiClinicalAdviceEnabled' => false,
        'clinicalPolicyVersion' => PF_CLINICAL_POLICY_VERSION,
    ];
}

function pf_clinical_capability_enabled($db, $clinicId, $capability) {
    $policy = pf_clinical_safety_policy($db, $clinicId);
    return array_key_exists($capability, $policy) && $policy[$capability] === true;
}

function pf_enforce_clinical_capability($db, $clinicId, $capability, $message) {
    if (pf_clinical_capability_enabled($db, $clinicId, $capability)) return;

    send_error($message, 403, [
        'code' => 'clinical_feature_unavailable',
        'capability' => $capability,
        'operatingMode' => PF_OPERATING_MODE_OPERATIONS_ONLY,
        'policyVersion' => PF_CLINICAL_POLICY_VERSION,
    ]);
}

function pf_input_has_meaningful_value($value) {
    if ($value === null || $value === '' || $value === [] || $value === '{}') return false;
    if (is_string($value)) {
        $trimmed = trim($value);
        if ($trimmed === '' || $trimmed === '[]' || $trimmed === '{}') return false;
        $decoded = json_decode($trimmed, true);
        if (json_last_error() === JSON_ERROR_NONE) return pf_input_has_meaningful_value($decoded);
    }
    if (is_array($value)) return count($value) > 0;
    return true;
}

function pf_ai_message_requests_clinical_guidance($message) {
    $message = strtolower(trim((string)$message));
    if ($message === '') return false;

    return (bool)preg_match('/\b(symptom|diagnos|pain|ache|hurt|toothache|swelling|inflam|bleed|blood|fever|rash|infection|pus|wound|numb|dizz|nause|vomit|headache|sick|unwell|side effect|allerg|pregnan|medicine|medication|antibiotic|prescription|dosage|dose|tablet|emergency|chest pain|shortness of breath|trouble breathing|what should i take|is this normal|safe for me|should i get|do i need|cure|heal|recommend (a )?treatment)\b/i', $message);
}

function pf_ai_operations_only_refusal($message = '') {
    $reply = "I can help with appointments and clinic information, but I can't assess symptoms, diagnose conditions, or recommend medicines or treatment. Please contact the clinic team for guidance or book an appointment.";
    if (preg_match('/\b(emergency|chest pain|shortness of breath|unconscious|severe bleeding)\b/i', (string)$message)) {
        $reply .= ' If this may be an emergency, contact local emergency services or go to the nearest emergency department now.';
    }
    return $reply;
}

function pf_ai_filter_operations_reply($message, $reply) {
    if (pf_ai_message_requests_clinical_guidance($message)) return pf_ai_operations_only_refusal($message);

    $unsafe = '/\b(diagnos|prescrib|antibiotic|dosage|\d+\s*mg|you should take|you should use|recommended treatment|treatment is)\b/i';
    if (preg_match($unsafe, (string)$reply)) return pf_ai_operations_only_refusal($message);
    return $reply;
}
