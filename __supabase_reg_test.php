<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    echo json_encode(['message' => 'Method not allowed']);
    exit;
}
if (!function_exists('curl_init')) {
    http_response_code(501);
    echo json_encode(['message' => 'PHP cURL is unavailable']);
    exit;
}
$curl = curl_init('https://fqcltmxiarohfpfnghjn.supabase.co/auth/v1/health');
curl_setopt_array($curl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => 7,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => [
        'apikey: sb_publishable_PqjH12Cbf7Fw9CWxvTPHaQ_MYYq7HQT',
        'Cache-Control: no-cache',
    ],
]);
$body = curl_exec($curl);
$status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
$failed = $body === false;
curl_close($curl);
if ($failed) {
    http_response_code(502);
    echo json_encode(['message' => 'REG.RU could not reach Supabase']);
    exit;
}
http_response_code($status > 0 ? $status : 502);
echo $body;
