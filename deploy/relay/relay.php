<?php
// Receipt relay for Smart Verify, on the Ethiopian hosting (Plesk, httpdocs/relay.php).
// The AWS server calls: GET relay.php?url=<receipt link> with header X-Relay-Key.
// Only the Telebirr and M-Pesa receipt sites are allowed. Nothing is stored.
// Put the same key as the AWS secret RECEIPT_RELAY_KEY (32+ characters) below.

const RELAY_KEY = 'PUT_THE_SAME_LONG_KEY_AS_RECEIPT_RELAY_KEY_HERE';
const ALLOWED_HOSTS = ['transactioninfo.ethiotelecom.et', 'm-pesabusiness.safaricom.et'];

header('Cache-Control: no-store');

function fail(int $code, string $message): void {
    // Never 400/404 here: the server reads those as "receipt not found".
    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    echo $message;
    exit;
}

$key = $_SERVER['HTTP_X_RELAY_KEY'] ?? '';
if (strlen(RELAY_KEY) < 32 || str_starts_with(RELAY_KEY, 'PUT_') || !hash_equals(RELAY_KEY, $key)) {
    fail(403, 'forbidden');
}

$url = $_GET['url'] ?? '';
$parts = parse_url($url);
if (!$parts || ($parts['scheme'] ?? '') !== 'https' || !in_array($parts['host'] ?? '', ALLOWED_HOSTS, true)
    || isset($parts['port']) || isset($parts['user'])) {
    fail(403, 'url not allowed');
}

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => 8,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
    CURLOPT_USERAGENT => 'Mozilla/5.0 (Linux; Android 13) SmartVerify',
    CURLOPT_HTTPHEADER => ['Accept: */*'],
]);
$body = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$type = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$errno = curl_errno($ch);
curl_close($ch);

if ($body === false || $errno !== 0) {
    fail($errno === CURLE_OPERATION_TIMEDOUT ? 504 : 502, 'receipt site did not answer');
}

// Pass the bank's answer through as it is (status, type, body).
http_response_code($status ?: 502);
header('Content-Type: ' . ($type !== '' ? $type : 'text/html; charset=utf-8'));
echo $body;
