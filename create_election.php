<?php

ob_start();

// Helper function to send JSON response and exit
function sendJsonResponse($data, $statusCode = 200) {
    // Clear any previous output (but keep headers)
    if (ob_get_level() > 0) {
        ob_clean();
    }
    
    // Set status code
    http_response_code($statusCode);
    
    // Output JSON
    echo json_encode($data);
    
    // End output buffering and send
    if (ob_get_level() > 0) {
        ob_end_flush();
    }
    exit();
}

@session_start();

// Headers FIRST
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    if (ob_get_level() > 0) {
        ob_end_clean();
    }
    exit();
}

// Error handling - log errors but don't display them
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Log function for debugging
function logError($message) {
    $logFile = __DIR__ . '/debug_log.txt';
    $logMessage = date('[Y-m-d H:i:s] ') . $message . "\n";
    // Try to write to log file, fall back to error_log if it fails
    @file_put_contents($logFile, $logMessage, FILE_APPEND);
    error_log($message);
}

logError("=== CREATE ELECTION REQUEST START ===");

try {
    // Check if user is logged in
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['role'])) {
        logError("Auth failed: No session");
        sendJsonResponse(["message" => "Access denied. Please log in."], 401);
    }

    // Check if the user is an Admin
    if ($_SESSION['role'] !== 'admin') {
        logError("Auth failed: Not admin, role is " . $_SESSION['role']);
        sendJsonResponse(["message" => "Access denied. Admin privileges required."], 403);
    }

    $admin_user_id = $_SESSION['user_id'];
    logError("Authenticated as admin user ID: $admin_user_id");

    // Database connection
    require_once(__DIR__ . '/db_connect.php');
    $database = new Database();
    $db = $database->getConnection();

    if (!$db) {
        logError("Database connection failed");
        sendJsonResponse(["message" => "Database connection failed."], 500);
    }

    logError("Database connected");

    // Check request method
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        logError("Wrong method: " . $_SERVER['REQUEST_METHOD']);
        sendJsonResponse(["message" => "Only POST requests are allowed."], 405);
    }

    // Get and validate JSON input
    $input = file_get_contents("php://input");
    logError("Raw input received: " . substr($input, 0, 200));
    
    $data = json_decode($input);

    if (json_last_error() !== JSON_ERROR_NONE) {
        logError("JSON decode error: " . json_last_error_msg());
        sendJsonResponse(["message" => "Invalid JSON data: " . json_last_error_msg()], 400);
    }

    // Validate required fields
    if (
        !$data ||
        !isset($data->electionTitle) || 
        !isset($data->startDate) || 
        !isset($data->startTime) || 
        !isset($data->endDate) || 
        !isset($data->endTime) ||
        !isset($data->candidates) || 
        !is_array($data->candidates) || 
        count($data->candidates) < 2
    ) {
        logError("Missing required fields");
        sendJsonResponse(["message" => "Missing or invalid election details or fewer than two candidates."], 400);
    }

    // Sanitize data
    $title = htmlspecialchars(strip_tags(trim($data->electionTitle)));
    $description = isset($data->electionDescription) ? htmlspecialchars(strip_tags(trim($data->electionDescription))) : '';

    // Validate title
    if (empty($title)) {
        logError("Empty title");
        sendJsonResponse(["message" => "Election title cannot be empty."], 400);
    }

    // Combine date and time
    $start_time = $data->startDate . ' ' . $data->startTime . ':00';
    $end_time = $data->endDate . ' ' . $data->endTime . ':00';

    logError("Start time: $start_time, End time: $end_time");

    // Validate dates
    if (strtotime($start_time) >= strtotime($end_time)) {
        logError("Invalid date range");
        sendJsonResponse(["message" => "End time must be after start time."], 400);
    }

    $creator_id = $admin_user_id;

    // Database transaction
    $db->beginTransaction();
    logError("Transaction started");

    try {
        // Insert election
        $election_query = "INSERT INTO elections 
                           (title, description, start_time, end_time, created_by) 
                           VALUES (:title, :description, :start_time, :end_time, :creator_id)";
        
        $stmt = $db->prepare($election_query);
        $stmt->bindParam(':title', $title);
        $stmt->bindParam(':description', $description);
        $stmt->bindParam(':start_time', $start_time);
        $stmt->bindParam(':end_time', $end_time);
        $stmt->bindParam(':creator_id', $creator_id);
        $stmt->execute();
        
        $election_id = $db->lastInsertId();
        logError("Election created with ID: $election_id");

        // Insert candidates
        $candidate_query = "INSERT INTO candidates 
                            (election_id, name, manifesto) 
                            VALUES (:election_id, :name, :manifesto)";
        $candidate_stmt = $db->prepare($candidate_query);

        $candidates_added = 0;
        foreach ($data->candidates as $candidate) {
            if (!isset($candidate->name) || empty(trim($candidate->name))) {
                continue;
            }

            $name = htmlspecialchars(strip_tags(trim($candidate->name)));
            $manifesto = isset($candidate->manifesto) ? htmlspecialchars(strip_tags(trim($candidate->manifesto))) : '';

            $candidate_stmt->bindParam(':election_id', $election_id);
            $candidate_stmt->bindParam(':name', $name);
            $candidate_stmt->bindParam(':manifesto', $manifesto);
            $candidate_stmt->execute();
            $candidates_added++;
            logError("Candidate added: $name");
        }

        // Final validation
        if ($candidates_added < 2) {
            throw new Exception("At least two valid candidates are required.");
        }

        // Commit transaction
        $db->commit();
        logError("Transaction committed successfully");
        
        sendJsonResponse([
            "message" => "Election successfully created and scheduled.",
            "status" => "success",
            "election_id" => $election_id,
            "candidates_added" => $candidates_added
        ], 201);

    } catch (Exception $e) {
        if (isset($db) && $db && $db->inTransaction()) {
            $db->rollBack();
            logError("Transaction rolled back");
        }
        
        logError("Election creation failed: " . $e->getMessage());
        logError("Stack trace: " . $e->getTraceAsString());
        sendJsonResponse([
            "message" => "Election creation failed: " . $e->getMessage()
        ], 500);
    }

} catch (Exception $e) {
    logError("Fatal error: " . $e->getMessage());
    logError("Stack trace: " . $e->getTraceAsString());
    sendJsonResponse([
        "message" => "Server error: " . $e->getMessage()
    ], 500);
} catch (Error $e) {
    // Catch PHP 7+ fatal errors
    logError("Fatal PHP error: " . $e->getMessage());
    logError("Stack trace: " . $e->getTraceAsString());
    sendJsonResponse([
        "message" => "Server error: " . $e->getMessage()
    ], 500);
}

if (isset($db) && $db !== null) {
    $db = null;
}
logError("=== CREATE ELECTION REQUEST END ===\n");

// Should never reach here, but just in case
if (ob_get_level() > 0) {
    ob_end_flush();
}
?>