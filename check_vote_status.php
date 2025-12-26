<?php
// check_vote_status.php - Check if a student has voted in an election

// Start output buffering
ob_start();

// Helper function to send JSON response
function sendJsonResponse($data, $statusCode = 200) {
    if (ob_get_level() > 0) {
        ob_clean();
    }
    header("Access-Control-Allow-Origin: *");
    header("Content-Type: application/json; charset=UTF-8");
    header("Access-Control-Allow-Credentials: true");
    http_response_code($statusCode);
    echo json_encode($data);
    if (ob_get_level() > 0) {
        ob_end_flush();
    }
    exit();
}

// Headers
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Credentials: true");

// Error handling
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Start session
session_start();

// Check authentication
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role'])) {
    sendJsonResponse(["message" => "Access denied. Please log in."], 401);
}

$user_id = $_SESSION['user_id'];

// Database connection
require_once(__DIR__ . '/db_connect.php');
$database = new Database();
$db = $database->getConnection();

if (!$db) {
    sendJsonResponse(["message" => "Database connection failed."], 500);
}

// Get election IDs from query parameter (comma-separated)
$election_ids = isset($_GET['election_ids']) ? $_GET['election_ids'] : '';

if (empty($election_ids)) {
    sendJsonResponse(["voted_elections" => []], 200);
}

// Parse election IDs
$ids = array_filter(array_map('intval', explode(',', $election_ids)));

if (empty($ids)) {
    sendJsonResponse(["voted_elections" => []], 200);
}

try {
    // Check which elections the user has voted in
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $query = "SELECT DISTINCT election_id FROM votes WHERE voter_id = ? AND election_id IN ($placeholders)";
    
    $stmt = $db->prepare($query);
    $params = array_merge([$user_id], $ids);
    $stmt->execute($params);
    
    $voted_elections = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $voted_elections[] = (int)$row['election_id'];
    }
    
    sendJsonResponse([
        "voted_elections" => $voted_elections
    ], 200);
    
} catch (PDOException $e) {
    error_log("Error checking vote status: " . $e->getMessage());
    sendJsonResponse(["message" => "Error checking vote status."], 500);
}

if (isset($db) && $db !== null) {
    $db = null;
}

if (ob_get_level() > 0) {
    ob_end_flush();
}
?>

