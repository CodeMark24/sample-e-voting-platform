<?php
// server.php - WebSocket Server using Ratchet 
require __DIR__ . '/vendor/autoload.php';

use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;
use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;

class ElectionWebSocket implements MessageComponentInterface {
    protected $clients;
    protected $users; // Map connection to user info
    
    public function __construct() {
        $this->clients = new \SplObjectStorage;
        $this->users = [];
        echo "WebSocket Server Started\n";
    }

    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        $this->users[$conn->resourceId] = [
            'conn' => $conn,
            'authenticated' => false,
            'user_id' => null,
            'role' => null,
            'username' => null,
            'session_id' => null // Added for better tracking
        ];
        
        echo "New connection! ({$conn->resourceId})\n";
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        $data = json_decode($msg, true);
        $senderId = $from->resourceId; //  Get ID directly from the connection

        if (!$data || !isset($data['type'])) {
            $this->sendError($from, "Invalid message format");
            return;
        }

        $type = $data['type'];
        
        switch($type) {
            case 'authenticate':
                if (isset($data['session_id']) && $data['session_id']) {
                    
                    $session_id = $data['session_id'];
                    
                 
                    $user_role = (rand(0, 1) === 0) ? 'student' : 'admin';
                    $user_id = $session_id; // Using session_id as placeholder ID
                    $username = "User_" . substr($session_id, 0, 4); 
                    
                    
                    if ($user_id && $user_role) {
                        $this->users[$senderId]['authenticated'] = true;
                        $this->users[$senderId]['user_id'] = $user_id;
                        $this->users[$senderId]['role'] = $user_role;
                        $this->users[$senderId]['username'] = $username;
                        $this->users[$senderId]['session_id'] = $session_id;

                        $this->sendToClient($from, [
                            'type' => 'authenticated',
                            'role' => $user_role
                        ]);
                        echo "User {$username} ({$senderId}) authenticated as {$user_role}.\n";
                    } else {
                        $this->sendError($from, "Authentication failed.");
                    }
                } else {
                    $this->sendError($from, "Missing session ID for authentication.");
                }
                break;
                
            case 'vote_cast':
                if (!$this->users[$senderId]['authenticated']) {
                    $this->sendError($from, "Authentication required.");
                    return;
                }
                
                if (isset($data['election_id'])) {
                    echo "Vote cast in election {$data['election_id']} by {$this->users[$senderId]['username']} ({$senderId}).\n";

                    // 1. Notify all admins of the new vote
                    $this->broadcastToRole('admin', [
                        'type' => 'vote_notification',
                        'election_id' => $data['election_id'],
                        'time' => time()
                    ]);

                    // 2. Since a vote was cast, request/simulate live results refresh
                    
                    $this->sendLiveResults($data['election_id']);
                }
                break;

            case 'election_update':
                if (!$this->users[$senderId]['authenticated'] || $this->users[$senderId]['role'] !== 'admin') {
                    $this->sendError($from, "Admin permission required.");
                    return;
                }
                
                if (isset($data['election_id']) && isset($data['status'])) {
                    echo "Election {$data['election_id']} status updated to {$data['status']} by Admin ({$senderId}).\n";

                    // Broadcast the status change to all authenticated users
                    $this->broadcastToAll([
                        'type' => 'election_status_change',
                        'election_id' => $data['election_id'],
                        'status' => $data['status'],
                        'message' => $data['message'] ?? "Election status changed to {$data['status']}."
                    ]);
                }
                break;

            case 'request_live_results':
                if (!$this->users[$senderId]['authenticated'] || $this->users[$senderId]['role'] !== 'admin') {
                    $this->sendError($from, "Admin permission required.");
                    return;
                }
                
                if (isset($data['election_id'])) {
                    echo "Admin ({$senderId}) requested live results for {$data['election_id']}.\n";
                    $this->sendLiveResults($data['election_id']);
                }
                break;

            default:
                $this->sendError($from, "Unknown message type: {$type}");
                break;
        }
    }

    public function onClose(ConnectionInterface $conn) {
        $resourceId = $conn->resourceId;
        $username = $this->users[$resourceId]['username'] ?? $resourceId;
        $this->clients->detach($conn);
        unset($this->users[$resourceId]);
        echo "Connection {$username} ({$resourceId}) has disconnected\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "An error has occurred on connection {$conn->resourceId}: {$e->getMessage()}\n";
        $conn->close();
    }

    //               HELPER FUNCTIONS
    
    // Helper: Sends simulated live results to all authenticated users
    private function sendLiveResults($electionId) {
        // --- Placeholder: SIMULATE FETCHING LATEST RESULTS ---
        // In a real application, you would connect to your database here.
        
        // This JSON structure must match what updateLiveResults in dashboard.js expects.
        $simulatedResults = [
            'type' => 'live_results',
            'election_id' => $electionId,
            'total_votes' => rand(10, 1000), 
            'results' => [
                'candidates' => [
                    [
                        'candidate_id' => 1,
                        'name' => 'Candidate A',
                        'vote_count' => rand(50, 400),
                    ],
                    [
                        'candidate_id' => 2,
                        'name' => 'Candidate B',
                        'vote_count' => rand(50, 400),
                    ],
                    // Add more candidates as needed
                ]
            ]
        ];

        // Ensure total votes is correct based on simulation
        $total = array_reduce($simulatedResults['results']['candidates'], function($carry, $item) {
            return $carry + $item['vote_count'];
        }, 0);
        $simulatedResults['total_votes'] = $total;
        
        // Broadcast the live results update to all authenticated users
        $this->broadcastToAll($simulatedResults);
        echo "Broadcast live results for election {$electionId}.\n";
    }

    // Helper: Send message to specific client
    private function sendToClient($conn, $data) {
        $conn->send(json_encode($data));
    }

    // Helper: Send error to client
    private function sendError($conn, $message) {
        $this->sendToClient($conn, [
            'type' => 'error',
            'message' => $message
        ]);
    }

    // Helper: Broadcast to all authenticated users
    private function broadcastToAll($data) {
        foreach ($this->clients as $client) {
            $resourceId = $client->resourceId;
            if (isset($this->users[$resourceId]) && 
                $this->users[$resourceId]['authenticated']) {
                $client->send(json_encode($data));
            }
        }
    }

    // Helper: Broadcast to users with specific role
    private function broadcastToRole($role, $data) {
        foreach ($this->clients as $client) {
            $resourceId = $client->resourceId;
            if (isset($this->users[$resourceId]) && 
                $this->users[$resourceId]['authenticated'] &&
                $this->users[$resourceId]['role'] === $role) {
                $client->send(json_encode($data));
            }
        }
    }
}

// Start the WebSocket server
echo "Starting WebSocket server on port 8080...\n";
$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new ElectionWebSocket()
        )
    ),
    8080
);

$server->run();