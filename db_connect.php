
<?php
// Set PHP timezone FIRST
date_default_timezone_set('Africa/Kampala');

class Database {
    private $host = 'localhost';
    private $db_name = 'evotingdb';
    private $username = 'root';
    private $password = 'mark24';
    
  // alternative credentials for a remote connection
  //  private $host = '192.168.137.95';
  //  private $db_name = 'eVotingDB';
  //  private $username = 'Web project';
  //  private $password = '1234';
      
     
    public $conn;

    /**
     * Get the database connection with timezone set
     * @return PDO|null
     */
    public function getConnection() {
        $this->conn = null;

        try {
            $this->conn = new PDO(
                "mysql:host=" . $this->host . ";dbname=" . $this->db_name, 
                $this->username, 
                $this->password
            );
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            
            // This ensures NOW() in MySQL matches PHP's date()
            $this->conn->exec("SET time_zone = '+03:00'"); // UTC+3 for East Africa Time
            
          
        } catch(PDOException $exception) {
            error_log("Connection error: " . $exception->getMessage());
            
        }

        return $this->conn;
    }
}
?>