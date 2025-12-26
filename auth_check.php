<?php
// auth_check.php
session_start();

// Check if user is logged in
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role'])) {
    http_response_code(401); // Unauthorized
    echo json_encode(["message" => "Access denied. Please log in."]);
    exit();
}

// Check if the user is an Admin
if ($_SESSION['role'] !== 'admin') {
    http_response_code(403); // Forbidden
    echo json_encode(["message" => "Access denied. Admin privileges required."]);
    exit();
}

// User is authenticated and is an admin
// We can use $_SESSION['user_id'] as the creator ID.
$admin_user_id = $_SESSION['user_id'];
?>