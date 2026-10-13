<?php
declare(strict_types=1);

/*
 * Same-origin, allow-listed HTTP proxy for the JamBalance Supabase project.
 * This runs on REG.RU so browsers do not have to connect to Supabase directly.
 * It deliberately does not proxy WebSockets; realtime pages should use polling.
 */

const UPSTREAM = 'https://fqcltmxiarohfpfnghjn.supabase.co';
const PUBLIC_API_KEY = 'sb_publishable_PqjH12Cbf7Fw9CWxvTPHaQ_MYYq7HQT';
const ALLOWED_ORIGIN = 'https://hub.jam-balance.ru';
const ALLOWED_PREFIXES = [
    '/auth/v1',
    '/rest/v1',
    '/storage/v1',
    '/functions/v1',
    '/graphql/v1',
];

header('Cache-Control: no-store');

function respondJson(int $status, array $body): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && $origin !== ALLOWED_ORIGIN) {
    respondJson(403, ['message' => 'Origin is not allowed']);
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$allowedMethods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
if (!in_array($method, $allowedMethods, true)) {
    respondJson(405, ['message' => 'Method is not allowed']);
}

$scriptPath = parse_url($_SERVER['SCRIPT_NAME'] ?? '/supabase-proxy.php', PHP_URL_PATH);
$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$pathInfo = $_SERVER['PATH_INFO'] ?? '';
if ($pathInfo !== '') {
    $apiPath = $pathInfo;
} elseif (is_string($scriptPath) && is_string($requestPath) && str_starts_with($requestPath, $scriptPath . '/')) {
    $apiPath = substr($requestPath, strlen($scriptPath));
} else {
    respondJson(404, ['message' => 'Supabase API path is missing']);
}

$allowedPath = false;
foreach (ALLOWED_PREFIXES as $prefix) {
    if ($apiPath === $prefix || str_starts_with($apiPath, $prefix . '/')) {
        $allowedPath = true;
        break;
    }
}
if (!$allowedPath) {
    respondJson(404, ['message' => 'Supabase API path is not allowed']);
}

$headers = function_exists('getallheaders') ? getallheaders() : [];
$headers = is_array($headers) ? array_change_key_case($headers, CASE_LOWER) : [];
$authorization = $headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null);

$forwardHeaders = [
    'apikey: ' . PUBLIC_API_KEY,
    'accept: ' . ($headers['accept'] ?? 'application/json'),
];
foreach ([
    'content-type', 'accept-profile', 'content-profile', 'prefer',
    'range', 'range-unit', 'x-client-info', 'idempotency-key',
] as $name) {
    if (isset($headers[$name]) && is_string($headers[$name])) {
        $forwardHeaders[] = $name . ': ' . $headers[$name];
    }
}
if (is_string($authorization) && $authorization !== '') {
    $forwardHeaders[] = 'authorization: ' . $authorization;
}
if ($origin !== '') {
    $forwardHeaders[] = 'origin: ' . ALLOWED_ORIGIN;
}

$query = $_SERVER['QUERY_STRING'] ?? '';
$target = UPSTREAM . $apiPath . ($query !== '' ? '?' . $query : '');
$curl = curl_init($target);
if ($curl === false) {
    respondJson(502, ['message' => 'Could not initialize upstream request']);
}

$responseHeaders = [];
curl_setopt_array($curl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_HTTPHEADER => $forwardHeaders,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_HEADERFUNCTION => static function ($curl, string $line) use (&$responseHeaders): int {
        $length = strlen($line);
        $parts = explode(':', $line, 2);
        if (count($parts) === 2) {
            $name = strtolower(trim($parts[0]));
            $value = trim($parts[1]);
            if (in_array($name, [
                'content-type', 'content-range', 'content-location', 'content-disposition',
                'cache-control', 'etag', 'last-modified', 'preference-applied',
                'location', 'retry-after', 'www-authenticate', 'sb-gateway-version',
                'sb-project-ref', 'x-request-id',
            ], true)) {
                $responseHeaders[$name] = $value;
            }
        }
        return $length;
    },
]);
if ($method === 'HEAD') {
    curl_setopt($curl, CURLOPT_NOBODY, true);
} elseif (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
    $body = file_get_contents('php://input');
    if ($body !== false && $body !== '') {
        curl_setopt($curl, CURLOPT_POSTFIELDS, $body);
    }
}

$body = curl_exec($curl);
$status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
$failed = $body === false;
curl_close($curl);

if ($failed) {
    respondJson(502, ['message' => 'The REG.RU server could not reach Supabase']);
}

http_response_code($status > 0 ? $status : 502);
foreach ($responseHeaders as $name => $value) {
    header($name . ': ' . $value);
}
if ($method !== 'HEAD' && $body !== '') {
    echo $body;
}
