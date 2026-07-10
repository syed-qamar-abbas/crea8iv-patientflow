<?php

function pf_render_checkin_qr_data_uri($payload) {
    $autoload = __DIR__ . '/../vendor/autoload.php';
    if (!is_file($autoload)) {
        throw new RuntimeException('Local QR dependency is not installed. Run composer install in backend-php.');
    }
    require_once $autoload;

    $image = (new \chillerlan\QRCode\QRCode())->render($payload);
    if (!is_string($image) || strpos($image, 'data:image/') !== 0) {
        throw new RuntimeException('Local QR generation failed');
    }
    return $image;
}
