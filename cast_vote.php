<?php
// cast_vote.php - WITH WEBSOCKET NOTIFICATION

// CRITICAL: Start session FIRST
session_start();

// Set timezone
date_default_timezone_set('Africa/Kampala');

// Start output buffering
ob_start();

// Helper function to send JSON response
function sendJsonResponse($data, $statusCode = 200) {
    if (ob_get_level() > 0) {
        ob_clean();
    }
    header("Access-Control-Allow-Origin: " . ($_SERVER['HTTP_ORIGIN'] ?? '*'));
    header("Content-Type: application/json; charset=UTF-8");
    header("Access-Control-Allow-Credentials: true");
    http_response_code($statusCode);
    echo json_encode($data);
    if (ob_get_level() > 0) {
        ob_end_flush();
    }
    exit();
}

// Set headers
header("Access-Control-Allow-Origin: " . ($_SERVER['HTTP_ORIGIN'] ?? '*'));
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Credentials: true");

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
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

// WebSocket notification function
function notifyWebSocket($electionId, $voterId) {
    try {
        // Create a client to send message to WebSocket server
        $client = stream_socket_client('tcp://localhost:8080', $errno, $errstr, 1);
        
        if ($client) {
            $message = json_encode([
                'type' => 'vote_notification',
                'election_id' => $electionId,
                'voter_id' => $voterId,
                'timestamp' => date('Y-m-d H:i:s')
            ]);
            
            fwrite($client, $message);
            fclose($client);
            
            logError("WebSocket notification sent for election $electionId");
        }
    } catch (Exception $e) {
        // Don't fail the vote if WebSocket notification fails
        logError("WebSocket notification failed: " . $e->getMessage());
    }
}

logError("=== CAST VOTE REQUEST START ===");
logError("Method: " . $_SERVER['REQUEST_METHOD']);

// Auth check
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role'])) {
    logError("No session - user_id: " . (isset($_SESSION['user_id']) ? 'SET' : 'NOT SET'));
    sendJsonResponse(["message" => "Access denied. Please log in."], 401);
}

if ($_SESSION['role'] !== 'student') {
    logError("Not student - role: " . $_SESSION['role']);
    sendJsonResponse(["message" => "Only students may vote."], 403);
}

$voter_id = $_SESSION['user_id'];
logError("Voter ID: $voter_id");

// Database connection
try {
    require_once(__DIR__ . '/db_connect.php');
    $database = new Database();
    $db = $database->getConnection();
    
    if (!$db) {
        logError("DB connection returned null");
        sendJsonResponse(["message" => "Database connection failed."], 500);
    }
    
    logError("DB connected");
} catch (Exception $e) {
    logError("DB connection exception: " . $e->getMessage());
    sendJsonResponse(["message" => "Database error: " . $e->getMessage()], 500);
}

// Check method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(["message" => "Only POST allowed."], 405);
}

// Get input
$input = file_get_contents("php://input");
logError("Input: " . $input);

if (empty($input)) {
    sendJsonResponse(["message" => "No data received."], 400);
}

$data = json_decode($input);

if (json_last_error() !== JSON_ERROR_NONE) {
    logError("JSON error: " . json_last_error_msg());
    sendJsonResponse(["message" => "Invalid JSON: " . json_last_error_msg()], 400);
}

if (!isset($data->election_id) || !isset($data->candidate_id)) {
    logError("Missing fields");
    sendJsonResponse(["message" => "Missing election_id or candidate_id."], 400);
}

$election_id = filter_var($data->election_id, FILTER_VALIDATE_INT);
$candidate_id = filter_var($data->candidate_id, FILTER_VALIDATE_INT);

if ($election_id === false || $candidate_id === false) {
    logError("Invalid IDs");
    sendJsonResponse(["message" => "Invalid IDs."], 400);
}

logError("election_id=$election_id, candidate_id=$candidate_id, voter_id=$voter_id");

// Start transaction
try {
    $db->beginTransaction();
    logError("Transaction started");
    
    // 1. Check election exists and is active
    $query = "SELECT election_id, title, start_time, end_time, NOW() as now
              FROM elections 
              WHERE election_id = :eid";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':eid', $election_id, PDO::PARAM_INT);
    $stmt->execute();
    
    if ($stmt->rowCount() == 0) {
        logError("Election $election_id not found");
        throw new Exception("Election not found.", 404);
    }
    
    $election = $stmt->fetch(PDO::FETCH_ASSOC);
    logError("Election: " . $election['title'] . " | Now: " . $election['now'] . " | Start: " . $election['start_time'] . " | End: " . $election['end_time']);
    
    // Check if active
    $now = strtotime($election['now']);
    $start = strtotime($election['start_time']);
    $end = strtotime($election['end_time']);
    
    logError("Timestamps - now: $now, start: $start, end: $end");
    
    if ($now < $start) {
        logError("Election not started yet");
        throw new Exception("Election has not started yet. Starts: " . $election['start_time'], 403);
    }
    
    if ($now > $end) {
        logError("Election ended");
        throw new Exception("Election has ended. Ended: " . $election['end_time'], 403);
    }
    
    logError("Election is ACTIVE");
    
    // 2. Verify candidate
    $query = "SELECT candidate_id, name FROM candidates 
              WHERE candidate_id = :cid AND election_id = :eid";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':cid', $candidate_id, PDO::PARAM_INT);
    $stmt->bindParam(':eid', $election_id, PDO::PARAM_INT);
    $stmt->execute();
    
    if ($stmt->rowCount() == 0) {
        logError("Candidate $candidate_id not found for election $election_id");
        throw new Exception("Invalid candidate.", 400);
    }
    
    $candidate = $stmt->fetch(PDO::FETCH_ASSOC);
    logError("Candidate: " . $candidate['name']);
    
    // 3. Check if already voted
    $query = "SELECT vote_id FROM votes 
              WHERE election_id = :eid AND voter_id = :vid";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':eid', $election_id, PDO::PARAM_INT);
    $stmt->bindParam(':vid', $voter_id, PDO::PARAM_INT);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        logError("Already voted");
        throw new Exception("You have already voted.", 409);
    }
    
    // 4. Insert vote
    $query = "INSERT INTO votes (election_id, voter_id, candidate_id) 
              VALUES (:eid, :vid, :cid)";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':eid', $election_id, PDO::PARAM_INT);
    $stmt->bindParam(':vid', $voter_id, PDO::PARAM_INT);
    $stmt->bindParam(':cid', $candidate_id, PDO::PARAM_INT);
    
    logError("Executing INSERT query");
    $stmt->execute();
    
    $vote_id = $db->lastInsertId();
    logError("Vote inserted: vote_id=$vote_id");
    
    $db->commit();
    logError("Transaction committed");
    
    // *** NOTIFY WEBSOCKET SERVER ***
    notifyWebSocket($election_id, $voter_id);
    
    sendJsonResponse([
        "message" => "Vote cast successfully for " . $candidate['name'] . "!",
        "status" => "success",
        "vote_id" => $vote_id,
        "election_id" => $election_id
    ], 200);
    
} catch (PDOException $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    
    logError("PDOException: " . $e->getMessage());
    logError("SQL State: " . $e->getCode());
    
    if (strpos($e->getMessage(), 'Duplicate') !== false || $e->getCode() == '23000') {
        sendJsonResponse(["message" => "You already voted."], 409);
    }
    
    sendJsonResponse([
        "message" => "Database error occurred."
    ], 500);
    
} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    
    logError("Exception: " . $e->getMessage());
    
    $code = $e->getCode();
    if ($code < 100 || $code > 599) $code = 500;
    
    sendJsonResponse([
        "message" => $e->getMessage()
    ], $code);
}

$db = null;
logError("=== END ===\n");

if (ob_get_level() > 0) {
    ob_end_flush();
}
?>