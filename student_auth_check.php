<?php
// student_auth_check.php
session_start();

// Check if user is logged in
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role'])) {
    http_response_code(401); // Unauthorized
    echo json_encode(["message" => "Access denied. Please log in."]);
    exit();
}

// Check if the user is a Student (voter)
if ($_SESSION['role'] !== 'student') {
    http_response_code(403); // Forbidden
    echo json_encode(["message" => "Access denied. Only students may vote."]);
    exit();
}

// User is authenticated and is a student
$voter_id = $_SESSION['user_id'];
?>