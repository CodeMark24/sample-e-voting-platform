<?php
// cancel_election.php - Cancel an election (Admin only)

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
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    if (ob_get_level() > 0) {
        ob_end_clean();
    }
    exit();
}

// Error handling
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Log function
function logError($message) {
    $logFile = __DIR__ . '/debug_log.txt';
    $logMessage = date('[Y-m-d H:i:s] ') . $message . "\n";
    @file_put_contents($logFile, $logMessage, FILE_APPEND);
    error_log($message);
}

logError("=== CANCEL ELECTION REQUEST START ===");

// Start session
session_start();

// Check authentication
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role'])) {
    logError("Auth failed: No session");
    sendJsonResponse(["message" => "Access denied. Please log in."], 401);
}

// Check if user is admin
if ($_SESSION['role'] !== 'admin') {
    logError("Auth failed: Not admin, role is " . $_SESSION['role']);
    sendJsonResponse(["message" => "Access denied. Admin privileges required."], 403);
}

$admin_id = $_SESSION['user_id'];
logError("Authenticated as admin user ID: $admin_id");

// Database connection
require_once(__DIR__ . '/db_connect.php');
$database = new Database();
$db = $database->getConnection();

if (!$db) {
    logError("Database connection failed");
    sendJsonResponse(["message" => "Database connection failed."], 500);
}

// Check request method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    logError("Wrong method: " . $_SERVER['REQUEST_METHOD']);
    sendJsonResponse(["message" => "Only POST requests are allowed."], 405);
}

// Get and validate JSON input
$input = file_get_contents("php://input");
logError("Raw input: " . $input);

if (empty($input)) {
    logError("Empty input received");
    sendJsonResponse(["message" => "No data received."], 400);
}

$data = json_decode($input);

if (json_last_error() !== JSON_ERROR_NONE) {
    logError("JSON decode error: " . json_last_error_msg());
    sendJsonResponse(["message" => "Invalid JSON data: " . json_last_error_msg()], 400);
}

if (!$data || !isset($data->election_id)) {
    logError("Missing election_id");
    sendJsonResponse(["message" => "Missing election_id."], 400);
}

// Validate election ID
$election_id = filter_var($data->election_id, FILTER_VALIDATE_INT);

if ($election_id === false) {
    logError("Invalid election_id format");
    sendJsonResponse(["message" => "Invalid election ID format."], 400);
}

logError("Cancelling election ID: $election_id");

// Start transaction
$db->beginTransaction();

try {
    // Check if election exists
    $check_query = "SELECT election_id, title, status FROM elections WHERE election_id = :eid LIMIT 1";
    $stmt = $db->prepare($check_query);
    $stmt->bindParam(':eid', $election_id, PDO::PARAM_INT);
    $stmt->execute();
    
    if ($stmt->rowCount() == 0) {
        logError("Election not found: $election_id");
        throw new Exception("Election not found.", 404);
    }
    
    $election = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Check if already cancelled
    if (isset($election['status']) && $election['status'] === 'cancelled') {
        logError("Election already cancelled");
        throw new Exception("Election is already cancelled.", 400);
    }
    
    // Update election status to cancelled
    // First, try to add status column if it doesn't exist (with error handling)
    try {
        $update_query = "UPDATE elections SET status = 'cancelled' WHERE election_id = :eid";
        $stmt = $db->prepare($update_query);
        $stmt->bindParam(':eid', $election_id, PDO::PARAM_INT);
        $stmt->execute();
    } catch (PDOException $e) {
        // If status column doesn't exist, we need to add it first
        if (strpos($e->getMessage(), 'status') !== false || strpos($e->getMessage(), 'Unknown column') !== false) {
            logError("Status column doesn't exist, adding it...");
            try {
                $alter_query = "ALTER TABLE elections ADD COLUMN status VARCHAR(20) DEFAULT 'active'";
                $db->exec($alter_query);
                logError("Status column added successfully");
                
                // Now update the election
                $update_query = "UPDATE elections SET status = 'cancelled' WHERE election_id = :eid";
                $stmt = $db->prepare($update_query);
                $stmt->bindParam(':eid', $election_id, PDO::PARAM_INT);
                $stmt->execute();
            } catch (PDOException $e2) {
                logError("Failed to add status column: " . $e2->getMessage());
                // Alternative: use a cancelled_at timestamp or is_cancelled flag
                // For now, we'll use end_time manipulation as fallback
                $update_query = "UPDATE elections SET end_time = NOW() WHERE election_id = :eid";
                $stmt = $db->prepare($update_query);
                $stmt->bindParam(':eid', $election_id, PDO::PARAM_INT);
                $stmt->execute();
                logError("Used end_time update as fallback");
            }
        } else {
            throw $e;
        }
    }
    
    logError("Election cancelled successfully: " . $election['title']);
    
    // Commit transaction
    $db->commit();
    
    sendJsonResponse([
        "message" => "Election '" . $election['title'] . "' has been cancelled successfully.",
        "status" => "success",
        "election_id" => $election_id
    ], 200);
    
} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
        logError("Transaction rolled back");
    }
    
    logError("Exception: " . $e->getMessage());
    $statusCode = $e->getCode() ?: 500;
    if ($statusCode < 100 || $statusCode > 599) {
        $statusCode = 500;
    }
    sendJsonResponse(["message" => $e->getMessage()], $statusCode);
}

if (isset($db) && $db !== null) {
    $db = null;
}

logError("=== CANCEL ELECTION REQUEST END ===\n");

if (ob_get_level() > 0) {
    ob_end_flush();
}
?>

