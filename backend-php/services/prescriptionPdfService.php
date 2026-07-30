<?php
require_once __DIR__ . '/../libs/fpdf.php';
require_once __DIR__ . '/pdfService.php'; // reuse pdf_enc()

class PrescriptionPDF extends FPDF {
    public $clinic;
    public $logoFile = null;

    public function __construct($clinic) {
        parent::__construct('P', 'mm', 'A4');
        $this->clinic = $clinic;
    }

    public function Header() {
        $primary = $this->clinic['primaryColor'] ?? '#0f766e';
        list($r, $g, $b) = $this->hex2rgb($primary);

        // Top colored band
        $this->SetFillColor($r, $g, $b);
        $this->Rect(0, 0, 210, 34, 'F');

        // Clinic logo (optional) on the left inside a white rounded chip
        $textX = 15;
        if ($this->logoFile) {
            $this->SetFillColor(255, 255, 255);
            $this->Rect(12, 6, 22, 22, 'F');
            // fit within the chip with a small margin
            $this->Image($this->logoFile, 13.5, 7.5, 19, 19);
            $textX = 40;
        }

        $this->SetTextColor(255, 255, 255);
        $this->SetFont('Helvetica', 'B', 18);
        $this->SetXY($textX, 8);
        $this->Cell(120, 8, pdf_enc($this->clinic['name'] ?? 'Clinic'), 0, 1);

        $this->SetFont('Helvetica', '', 8.5);
        $this->SetX($textX);
        $addr = trim(($this->clinic['address'] ?? ''));
        if ($addr !== '') { $this->Cell(120, 4.5, pdf_enc($addr), 0, 1); $this->SetX($textX); }
        $contact = trim(($this->clinic['phone'] ?? '') . (empty($this->clinic['email']) ? '' : '  |  ' . $this->clinic['email']));
        $web = trim((string)($this->clinic['website'] ?? ''));
        if ($web !== '') $contact = trim($contact . (empty($contact) ? '' : '  |  ') . $web);
        if ($contact !== '') $this->Cell(120, 4.5, pdf_enc($contact), 0, 1);

        // Rx title on the right
        $this->SetXY(150, 9);
        $this->SetFont('Helvetica', 'BI', 30);
        $this->Cell(45, 12, 'Rx', 0, 1, 'R');

        $this->SetY(40);
    }

    public function Footer() {
        $this->SetY(-16);
        $this->SetDrawColor(226, 232, 240);
        $this->Line(15, $this->GetY(), 195, $this->GetY());
        $this->SetY(-13);
        $this->SetTextColor(120, 130, 145);
        $this->SetFont('Helvetica', 'I', 7.5);
        $this->Cell(0, 4, pdf_enc('This prescription is issued by ' . ($this->clinic['name'] ?? 'the clinic') . '. Please follow the dosage and instructions exactly as written.'), 0, 1, 'C');
        $this->Cell(0, 4, 'Page ' . $this->PageNo(), 0, 0, 'C');
    }

    public function hex2rgb($hex) {
        $hex = str_replace('#', '', $hex);
        if (strlen($hex) == 3) {
            return [hexdec(str_repeat($hex[0],2)), hexdec(str_repeat($hex[1],2)), hexdec(str_repeat($hex[2],2))];
        }
        return [hexdec(substr($hex,0,2)), hexdec(substr($hex,2,2)), hexdec(substr($hex,4,2))];
    }
}

function pf_age_from_dob($dob) {
    if (empty($dob)) return '';
    $ts = strtotime($dob);
    if ($ts === false) return '';
    $age = (int)floor((time() - $ts) / 31557600);
    return ($age >= 0 && $age < 150) ? (string)$age : '';
}

// Writes a temp file from a base64 data URL; returns path or null.
function pf_tmp_image_from_dataurl($dataUrl) {
    if (empty($dataUrl) || !preg_match('#^data:image/(png|jpe?g);base64,(.+)$#s', $dataUrl, $m)) return null;
    $bin = base64_decode($m[2]);
    if ($bin === false || strlen($bin) === 0) return null;
    $path = sys_get_temp_dir() . '/pfrx_' . uniqid() . '.' . ($m[1] === 'png' ? 'png' : 'jpg');
    file_put_contents($path, $bin);
    return $path;
}

function generatePrescriptionPDF($rx, $client, $clinic) {
    $clinic = $clinic ?: [];
    $client = $client ?: [];
    $pdf = new PrescriptionPDF($clinic);
    // pf_logo_tempfile (from pdfService) re-encodes via GD, so any format works
    // (incl. WebP stamps) and a bad image can't crash the PDF.
    $pdf->logoFile = pf_logo_tempfile($clinic['logo'] ?? '');
    $stampFile = pf_logo_tempfile($clinic['stampImage'] ?? '');
    $pdf->AddPage();

    list($r, $g, $b) = $pdf->hex2rgb($clinic['primaryColor'] ?? '#0f766e');

    // ---- Doctor + meta row ----
    $pdf->SetTextColor(30, 41, 59);
    $pdf->SetFont('Helvetica', 'B', 11);
    $doc = trim((string)($rx['doctorName'] ?? ''));
    if ($doc !== '') {
        $pdf->SetX(15);
        $pdf->Cell(120, 6, pdf_enc($doc), 0, 0, 'L');
    }
    $pdf->SetFont('Helvetica', '', 9);
    $pdf->SetTextColor(90, 100, 115);
    $pdf->Cell(0, 6, pdf_enc('Date: ' . ($rx['date'] ?? date('Y-m-d'))), 0, 1, 'R');
    $sub = array_filter([$rx['doctorQualification'] ?? '', ($rx['doctorRegNo'] ?? '') ? ('Reg. No: ' . $rx['doctorRegNo']) : '']);
    if ($sub) {
        $pdf->SetX(15);
        $pdf->SetFont('Helvetica', '', 8.5);
        $pdf->Cell(0, 5, pdf_enc(implode('  |  ', $sub)), 0, 1, 'L');
    }

    // ---- Patient panel ----
    $pdf->Ln(2);
    $pdf->SetFillColor(247, 249, 251);
    $panelY = $pdf->GetY();
    $pdf->Rect(15, $panelY, 180, 16, 'F');
    $age = pf_age_from_dob($client['dob'] ?? '');
    $bits = [];
    $bits[] = 'Patient: ' . ($client['name'] ?? '-');
    if ($age !== '') $bits[] = 'Age: ' . $age;
    if (!empty($client['gender'])) $bits[] = 'Gender: ' . ucfirst($client['gender']);
    if (!empty($client['patientNo'])) $bits[] = 'ID: ' . $client['patientNo'];
    $line2 = [];
    if (!empty($client['phone'])) $line2[] = 'Phone: ' . $client['phone'];
    if (!empty($rx['prescriptionNo'])) $line2[] = 'Rx No: ' . $rx['prescriptionNo'];

    $pdf->SetXY(19, $panelY + 3);
    $pdf->SetTextColor(30, 41, 59);
    $pdf->SetFont('Helvetica', 'B', 9.5);
    $pdf->Cell(172, 5, pdf_enc(implode('     ', $bits)), 0, 1);
    if ($line2) {
        $pdf->SetX(19);
        $pdf->SetTextColor(90, 100, 115);
        $pdf->SetFont('Helvetica', '', 8.5);
        $pdf->Cell(172, 5, pdf_enc(implode('     ', $line2)), 0, 1);
    }
    $pdf->SetY($panelY + 20);

    // ---- section helper ----
    $section = function ($title, $body) use ($pdf, $r, $g, $b) {
        $body = trim((string)$body);
        if ($body === '') return;
        $pdf->SetX(15);
        $pdf->SetTextColor($r, $g, $b);
        $pdf->SetFont('Helvetica', 'B', 9);
        $pdf->Cell(0, 5, strtoupper($title), 0, 1);
        $pdf->SetX(15);
        $pdf->SetTextColor(40, 50, 65);
        $pdf->SetFont('Helvetica', '', 9.5);
        $pdf->MultiCell(180, 5, pdf_enc($body), 0, 'L');
        $pdf->Ln(2);
    };

    $section('Diagnosis / Chief Complaint', $rx['diagnosis'] ?? '');
    $section('Clinical Notes', $rx['clinicalNotes'] ?? '');

    // ---- Medicines table ----
    $meds = is_array($rx['medicines'] ?? null) ? $rx['medicines'] : [];
    if (!empty($meds)) {
        $pdf->SetX(15);
        $pdf->SetTextColor($r, $g, $b);
        $pdf->SetFont('Helvetica', 'B', 9);
        $pdf->Cell(0, 5, 'MEDICATIONS', 0, 1);

        // header row
        $pdf->SetFillColor($r, $g, $b);
        $pdf->SetTextColor(255, 255, 255);
        $pdf->SetFont('Helvetica', 'B', 8.5);
        $cols = [[10,'#'],[52,'Medicine'],[26,'Dosage'],[30,'Frequency'],[24,'Duration'],[38,'Instructions']];
        $pdf->SetX(15);
        foreach ($cols as $c) $pdf->Cell($c[0], 6, $c[1], 0, 0, 'L');
        $pdf->Ln();

        $pdf->SetTextColor(40, 50, 65);
        $pdf->SetFont('Helvetica', '', 8.5);
        $i = 1;
        foreach ($meds as $m) {
            if ($pdf->GetY() > 250) { $pdf->AddPage(); }
            $fill = ($i % 2 === 0);
            $pdf->SetFillColor(247, 249, 251);
            $rowVals = [
                (string)$i,
                pdf_enc($m['name'] ?? ''),
                pdf_enc($m['dosage'] ?? ''),
                pdf_enc($m['frequency'] ?? ''),
                pdf_enc($m['duration'] ?? ''),
                pdf_enc($m['instructions'] ?? ''),
            ];
            $pdf->SetX(15);
            $x = 0;
            foreach ($cols as $idx => $c) {
                $pdf->Cell($c[0], 6, $rowVals[$idx], 'B', 0, 'L', $fill);
            }
            $pdf->Ln();
            $i++;
        }
        $pdf->Ln(3);
    }

    $section('Investigations / Lab Tests', $rx['investigations'] ?? '');
    if (!empty($rx['followUpDate'])) $section('Follow-up Date', $rx['followUpDate']);
    $section('Additional Notes', $rx['additionalNotes'] ?? '');

    // ---- Signature / stamp area (bottom right) ----
    $sy = max($pdf->GetY() + 8, 235);
    if ($sy > 250) { $pdf->AddPage(); $sy = 60; }
    if ($stampFile) {
        $pdf->Image($stampFile, 140, $sy - 18, 45, 18);
    }
    $pdf->SetDrawColor(150, 160, 175);
    $pdf->Line(135, $sy, 195, $sy);
    $pdf->SetXY(135, $sy + 1);
    $pdf->SetTextColor(90, 100, 115);
    $pdf->SetFont('Helvetica', '', 8.5);
    $pdf->Cell(60, 4, pdf_enc(($rx['doctorName'] ?? 'Doctor') . ' — Signature / Stamp'), 0, 1, 'C');

    $out = $pdf->Output('S');
    if ($pdf->logoFile) @unlink($pdf->logoFile);
    if ($stampFile) @unlink($stampFile);
    return $out;
}
