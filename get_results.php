<?php

// Configuration & Headers
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");

// Include database connection (no need for session check since results are public)
require_once(__DIR__ . '/db_connect.php'); 
$database = new Database();
$db = $database->getConnection();

// --- 2. Get Input and Validation --
// Expects election_id via GET parameter
if (!isset($_GET['id']) || empty($_GET['id'])) {
    http_response_code(400);
    echo json_encode(["message" => "Missing election ID."]);
    exit();
}

$election_id = htmlspecialchars(strip_tags(trim($_GET['id'])));

try {
    // 3. SQL Query to Calculate Results 
    // This query joins candidates and votes, groups by candidate, and counts the votes.
    $query = "
        SELECT 
            c.candidate_id, 
            c.name,
            c.manifesto,
            COUNT(v.vote_id) AS vote_count
        FROM candidates c
        LEFT JOIN votes v ON c.candidate_id = v.candidate_id
        WHERE c.election_id = :eid
        GROUP BY c.candidate_id
        ORDER BY vote_count DESC, c.name ASC"; // Order by vote count (highest first)

    $stmt = $db->prepare($query);
    $stmt->bindParam(':eid', $election_id);
    $stmt->execute();

    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get the total number of votes cast for context
    $total_votes_query = "SELECT COUNT(vote_id) AS total_votes FROM votes WHERE election_id = :eid";
    $total_stmt = $db->prepare($total_votes_query);
    $total_stmt->bindParam(':eid', $election_id);
    $total_stmt->execute();
    $total_votes = $total_stmt->fetch(PDO::FETCH_ASSOC)['total_votes'];
    
    // 4. Success Response 
    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "election_id" => $election_id,
        "total_votes" => $total_votes,
        "results" => $results
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    error_log("Results calculation failed: " . $e->getMessage());
    echo json_encode(["message" => "Failed to fetch election results."]);
}

$db = null;
?>