<?php

function pf_record_invoice_payment_event(
    $db,
    $clinicId,
    $invoiceId,
    $clientId,
    $amount,
    $type = 'payment',
    $paymentMethod = null,
    $createdBy = null,
    $paidAt = null,
    $notes = null,
    $sourceKey = null
) {
    $amount = round(floatval($amount), 2);
    if (abs($amount) < 0.005) return null;

    $allowedTypes = ['payment', 'refund', 'adjustment', 'cancellation', 'legacy'];
    if (!in_array($type, $allowedTypes, true)) {
        throw new InvalidArgumentException('Invalid invoice payment event type');
    }

    $id = generate_uuid();
    $stmt = $db->prepare("INSERT INTO InvoicePaymentEntry
        (id, clinicId, invoiceId, clientId, amount, type, paymentMethod, paidAt, createdBy, notes, sourceKey)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $id,
        $clinicId,
        $invoiceId,
        $clientId,
        $amount,
        $type,
        $paymentMethod ? trim((string)$paymentMethod) : null,
        $paidAt ?: date('Y-m-d H:i:s'),
        $createdBy ?: null,
        $notes ? trim((string)$notes) : null,
        $sourceKey ?: null,
    ]);
    return $id;
}

function pf_invoice_payment_sum($db, $clinicId, $from = null, $to = null) {
    $where = ['clinicId = ?'];
    $params = [$clinicId];
    if ($from && $to) {
        $where[] = 'paidAt >= ? AND paidAt <= ?';
        $params[] = $from;
        $params[] = $to;
    }
    $stmt = $db->prepare('SELECT COALESCE(SUM(amount), 0) FROM InvoicePaymentEntry WHERE ' . implode(' AND ', $where));
    $stmt->execute($params);
    return floatval($stmt->fetchColumn() ?: 0);
}
