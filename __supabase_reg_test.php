<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

if (!function_exists('curl_init')) {
    http_response_code(501);
    echo json_encode(['ok' => false, 'error' => 'PHP cURL extension is unavailable']);
    exit;
}

$curl = curl_init('https://fqcltmxiarohfpfnghjn.supabase.co/auth/v1/health');
curl_setopt_array($curl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => [
        'apikey: sb_publishable_PqjH12Cbf7Fw9CWxvTPHaQ_MYYq7HQT',
        'Accept: application/json',
    ],
]);

$body = curl_exec($curl);
$status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
$error = curl_error($curl);
curl_close($curl);

if ($body === false) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => $error ?: 'Connection failed']);
    exit;
}

$data = json_decode($body, true);
if ($status < 200 || $status >= 300) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'upstream_status' => $status, 'response' => $data]);
    exit;
}

echo json_encode([
    'ok' => true,
    'upstream_status' => $status,
    'service' => $data['name'] ?? null,
    'version' => $data['version'] ?? null,
]);
