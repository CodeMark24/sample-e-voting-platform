<?php
// Start session FIRST (before any output)
session_start();

// Headers
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Error handling for production
error_reporting(E_ALL);
ini_set('display_errors', 0); // Set to 1 for debugging
ini_set('log_errors', 1);

// Include database connection (FIXED PATH)
require_once('db_connect.php');

// Initialize database
$database = new Database();
$db = $database->getConnection();

// Check if connection failed
if (!$db) {
    http_response_code(500);
    echo json_encode(["message" => "Database connection failed."]);
    exit();
}

// Check request method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["message" => "Only POST requests are allowed."]);
    exit();
}

// Get and validate JSON input
$input = file_get_contents("php://input");
$data = json_decode($input);

if (!$data || !isset($data->username) || !isset($data->password)) {
    http_response_code(400);
    echo json_encode(["message" => "Missing username or password."]);
    exit();
}

$username = htmlspecialchars(strip_tags(trim($data->username)));
$password = $data->password;

if (empty($username) || empty($password)) {
    http_response_code(400);
    echo json_encode(["message" => "Username and password cannot be empty."]);
    exit();
}

try {
    // Prepare and execute query
    $query = "SELECT user_id, password_hash, role FROM users WHERE username = :username LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':username', $username);
    $stmt->execute();
    
    if ($stmt->rowCount() > 0) {
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $user_id = $row['user_id'];
        $password_hash = $row['password_hash'];
        $role = $row['role'];

        // Verify password
        if (password_verify($password, $password_hash)) {
            // Success - Set session variables
            $_SESSION['user_id'] = $user_id;
            $_SESSION['username'] = $username;
            $_SESSION['role'] = $role;

            http_response_code(200);
            echo json_encode([
                "message" => "Login successful.",
                "status" => "success",
                "role" => $role,
                "username" => $username
            ]);
        } else {
            // Wrong password
            http_response_code(401);
            echo json_encode(["message" => "Login failed. Invalid credentials."]);
        }
    } else {
        // User not found
        http_response_code(401);
        echo json_encode(["message" => "Login failed. Invalid credentials."]);
    }
} catch (PDOException $e) {
    error_log("Login error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["message" => "Server error during login."]);
}

$db = null;
?>