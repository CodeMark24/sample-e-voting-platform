<?php
// get_elections.php - Fetch elections by status

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

// Database connection
require_once(__DIR__ . '/db_connect.php');
$database = new Database();
$db = $database->getConnection();

if (!$db) {
    sendJsonResponse(["message" => "Database connection failed."], 500);
}

// Get status parameter (upcoming, active, completed, or all)
$status = isset($_GET['status']) ? $_GET['status'] : 'all';
$status = htmlspecialchars(strip_tags(trim($status)));

try {
    $now = date('Y-m-d H:i:s');
    
    // Build query based on status
    switch($status) {
        case 'upcoming':
            // Elections that haven't started yet
            $query = "SELECT e.election_id, e.title, e.description, e.start_time, e.end_time, 
                             e.created_by, COUNT(DISTINCT c.candidate_id) AS candidate_count
                      FROM elections e
                      LEFT JOIN candidates c ON e.election_id = c.election_id
                      WHERE e.start_time > :now
                      GROUP BY e.election_id, e.title, e.description, e.start_time, e.end_time, e.created_by
                      ORDER BY e.start_time ASC";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':now', $now);
            break;
            
        case 'active':
            // Elections currently open for voting (exclude cancelled)
            // Check if status column exists first
            $status_column_exists = false;
            try {
                $check_query = "SHOW COLUMNS FROM elections LIKE 'status'";
                $check_stmt = $db->query($check_query);
                $status_column_exists = $check_stmt->rowCount() > 0;
            } catch (PDOException $e) {
                // Column doesn't exist or table error
                $status_column_exists = false;
            }
            
            if ($status_column_exists) {
                $query = "SELECT e.election_id, e.title, e.description, e.start_time, e.end_time, 
                                 e.created_by, COUNT(DISTINCT c.candidate_id) AS candidate_count,
                                 COALESCE(e.status, 'active') AS status
                          FROM elections e
                          LEFT JOIN candidates c ON e.election_id = c.election_id
                          WHERE e.start_time <= :now 
                            AND e.end_time >= :now2
                            AND (e.status IS NULL OR e.status != 'cancelled')
                          GROUP BY e.election_id, e.title, e.description, e.start_time, e.end_time, e.created_by, e.status
                          ORDER BY e.end_time ASC";
            } else {
                // Status column doesn't exist yet, use simpler query
                $query = "SELECT e.election_id, e.title, e.description, e.start_time, e.end_time, 
                                 e.created_by, COUNT(DISTINCT c.candidate_id) AS candidate_count,
                                 'active' AS status
                          FROM elections e
                          LEFT JOIN candidates c ON e.election_id = c.election_id
                          WHERE e.start_time <= :now 
                            AND e.end_time >= :now2
                          GROUP BY e.election_id, e.title, e.description, e.start_time, e.end_time, e.created_by
                          ORDER BY e.end_time ASC";
            }
            $stmt = $db->prepare($query);
            $stmt->bindParam(':now', $now);
            $stmt->bindParam(':now2', $now);
            break;
            
        case 'completed':
            // Elections that have ended
            $query = "SELECT e.election_id, e.title, e.description, e.start_time, e.end_time, 
                             e.created_by, COUNT(DISTINCT c.candidate_id) AS candidate_count
                      FROM elections e
                      LEFT JOIN candidates c ON e.election_id = c.election_id
                      WHERE e.end_time < :now
                      GROUP BY e.election_id, e.title, e.description, e.start_time, e.end_time, e.created_by
                      ORDER BY e.end_time DESC";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':now', $now);
            break;
            
        case 'all':
        default:
            // All elections
            $query = "SELECT e.election_id, e.title, e.description, e.start_time, e.end_time, 
                             e.created_by, COUNT(DISTINCT c.candidate_id) AS candidate_count,
                             CASE 
                                 WHEN e.start_time > :now THEN 'upcoming'
                                 WHEN e.start_time <= :now AND e.end_time >= :now2 THEN 'active'
                                 ELSE 'completed'
                             END AS status
                      FROM elections e
                      LEFT JOIN candidates c ON e.election_id = c.election_id
                      GROUP BY e.election_id, e.title, e.description, e.start_time, e.end_time, e.created_by
                      ORDER BY e.start_time DESC";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':now', $now);
            $stmt->bindParam(':now2', $now);
            break;
    }
    
    $stmt->execute();
    $elections = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // For each election, get candidates if needed
    foreach ($elections as &$election) {
        $election_id = $election['election_id'];
        
        // Get candidates for this election
        $candidate_query = "SELECT candidate_id, name, manifesto 
                           FROM candidates 
                           WHERE election_id = :eid 
                           ORDER BY name ASC";
        $candidate_stmt = $db->prepare($candidate_query);
        $candidate_stmt->bindParam(':eid', $election_id);
        $candidate_stmt->execute();
        $election['candidates'] = $candidate_stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Determine status if not already set
        if (!isset($election['status'])) {
            $start_time = strtotime($election['start_time']);
            $end_time = strtotime($election['end_time']);
            $current_time = time();
            
            if ($current_time < $start_time) {
                $election['status'] = 'upcoming';
            } elseif ($current_time >= $start_time && $current_time <= $end_time) {
                $election['status'] = 'active';
            } else {
                $election['status'] = 'completed';
            }
        }
    }
    
    sendJsonResponse([
        "status" => "success",
        "count" => count($elections),
        "elections" => $elections
    ], 200);
    
} catch (PDOException $e) {
    error_log("Failed to fetch elections: " . $e->getMessage());
    sendJsonResponse(["message" => "Failed to fetch elections."], 500);
} catch (Exception $e) {
    error_log("Error: " . $e->getMessage());
    sendJsonResponse(["message" => "An error occurred."], 500);
}

if (isset($db) && $db !== null) {
    $db = null;
}

if (ob_get_level() > 0) {
    ob_end_flush();
}
?>

