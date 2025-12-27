# sample-e-voting-platform
Simple e-voting system for an academic institution implemented in php
#Online Election System

## Project Overview

This is a web-based election system built for a higher educational institution. The system allows students to vote in elections and administrators to create and manage elections. It includes real-time updates using WebSocket technology.

## Features

### For Students
- View upcoming elections
- Vote in active elections
- View election results after voting closes
- Real-time notifications when voting
- Secure, one-vote-per-election system

### For Administrators
- Create new elections with multiple candidates
- Set election start and end times
- Cancel elections if needed
- View live vote counts as they happen
- Monitor election status in real-time
- View and certify results

### Technical Features
- User authentication with role-based access
- Real-time updates using WebSocket connections
- Secure password storage with PHP password hashing
- Session management for user security
- MySQL database for data storage
- Responsive web interface

## System Requirements

### Server Requirements
- PHP 7.4 or higher
- MySQL 5.7 or higher
- Apache or Nginx web server
- Composer (PHP package manager)
- Command line access for WebSocket server

### Browser Requirements
- Modern web browser with JavaScript enabled
- WebSocket support (all modern browsers)
- Cookies enabled for session management

## File Structure

```
project-root/
├── index.html                  # Login page
├── login.php                   # Authentication handler
├── login.js                    # Login form handler
├── dashboard.html              # Main dashboard interface
├── dashboard.js                # Dashboard functionality with WebSocket
├── create_election_form.html   # Election creation form
├── create_election.js          # Election creation logic
├── create_election.php         # Election creation backend
├── cast_vote.php              # Vote casting backend
├── get_elections.php          # Fetch elections by status
├── get_results.php            # Fetch election results
├── check_vote_status.php      # Check if user has voted
├── cancel_election.php        # Cancel election (admin)
├── auth_check.php             # Session authentication check
├── db_connect.php             # Database connection configuration
├── styles.css                 # Application stylesheet
├── server.php                 # WebSocket server
├── websocket-client.js        # WebSocket client
├── composer.json              # PHP dependencies
├── vendor/                    # Composer packages (auto-generated)
├── debug_log.txt             # Application logs (auto-generated)
└── README.md                  # This file
```

## Database Schema

### Create Database

```sql
CREATE DATABASE eVotingDB;
USE eVotingDB;
```

### Users Table

```sql
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'admin') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Elections Table

```sql
CREATE TABLE elections (
    election_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    created_by INT NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);
```

### Candidates Table

```sql
CREATE TABLE candidates (
    candidate_id INT AUTO_INCREMENT PRIMARY KEY,
    election_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    manifesto TEXT,
    FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE
);
```

### Votes Table

```sql
CREATE TABLE votes (
    vote_id INT AUTO_INCREMENT PRIMARY KEY,
    election_id INT NOT NULL,
    voter_id INT NOT NULL,
    candidate_id INT NOT NULL,
    vote_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (election_id) REFERENCES elections(election_id) ON DELETE CASCADE,
    FOREIGN KEY (voter_id) REFERENCES users(user_id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(candidate_id),
    UNIQUE KEY unique_vote (election_id, voter_id)
);
```

### Sample User Data

```sql
-- Admin user (password: admin123)
INSERT INTO users (username, password_hash, role) VALUES 
('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

-- Student user (password: student123)
INSERT INTO users (username, password_hash, role) VALUES 
('student1', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student');
```

## Installation Steps

### Step 1: Database Setup
Create the MySQL database and tables using the SQL queries provided above. Update the database connection credentials in db_connect.php to match your MySQL server settings.

### Step 2: Install Dependencies
Run composer install in the project directory to install the Ratchet WebSocket library and its dependencies. Composer must be installed on your system first.

### Step 3: Configure Application
Edit db_connect.php with your database credentials including host, database name, username, and password. Set the correct timezone for your location.

### Step 4: Start WebSocket Server
Open a terminal and run the server.php file using PHP. This starts the WebSocket server on port 8080. The server must remain running for real-time features to work.

### Step 5: Access the System
Open your web browser and navigate to the index.html file. Login with the sample credentials provided or create your own users in the database.

## How It Works

### Authentication Flow
Users enter their username and password on the login page. The system verifies credentials against the database using secure password hashing. Upon successful login, a session is created with the user's ID and role. The session determines what features the user can access.

### Student Voting Process
Students can view a list of active elections. When they select an election, they see all candidates with their manifestos. After selecting a candidate and submitting their vote, the system checks if the election is active and if they have not already voted. The vote is recorded in the database and a confirmation is shown. The WebSocket server notifies administrators in real-time.

### Admin Management Process
Administrators can create new elections by filling out a form with election details, dates, and candidates. They can view all elections regardless of status. For active elections, they can see live vote counts as students vote. They can also cancel elections before or during voting if needed.

### Real-Time Updates
When a student casts a vote, the system notifies the WebSocket server. The server broadcasts this information to all connected administrators. Administrators see live updates of vote counts without refreshing the page. The WebSocket connection automatically reconnects if it drops.

## Security Features

### Password Security
All passwords are hashed using PHP's password_hash function before storing in the database. Passwords are never stored in plain text. During login, the system verifies passwords using password_verify to compare the entered password with the stored hash.

### Session Security
Each user gets a unique session upon login. Sessions store the user ID and role. All protected pages check for valid sessions before allowing access. Sessions expire after a period of inactivity.

### Voting Security
The database enforces one vote per student per election using a unique constraint. The system checks election timing to ensure votes are only cast during the active period. Vote timestamps are recorded for audit purposes.

### Access Control
Students can only vote and view results. Administrators can create, manage, and view detailed election information. The system checks user roles before allowing any administrative actions.

## Usage Guide

### For Students
Login to the system with your student credentials. Navigate to active elections to see available voting opportunities. Select an election to view candidates and their manifestos. Choose your preferred candidate and submit your vote. You will receive confirmation and the vote cannot be changed. After the election ends, return to view the results.

### For Administrators
Login with administrator credentials to access the management panel. Create new elections by providing a title, description, start time, end time, and at least two candidates. View upcoming elections to see what is scheduled. Monitor active elections to see live vote counts as they happen. View completed elections to see final results. Cancel elections if circumstances require it.

## Troubleshooting

### WebSocket Connection Problems
If real-time updates are not working, check that the WebSocket server is running. Verify that port 8080 is accessible and not blocked by firewall. Check the browser console for connection error messages. Ensure the WebSocket URL matches your server configuration.

### Login Issues
If you cannot login, verify your username and password are correct. Clear browser cookies and try again. Check that the database connection is working. Verify the users table has the correct password hashes.

### Voting Errors
If voting fails, check that the election is currently active. Verify you have not already voted in this election. Ensure the timezone settings are correct in both PHP and MySQL. Check the debug log file for specific error messages.

### Database Connection Errors
If the system cannot connect to the database, verify MySQL is running. Check the credentials in db_connect.php are correct. Ensure the database and tables exist. Verify the MySQL user has proper permissions.

## Configuration Options

### Timezone Settings
The system is configured for East Africa Time (UTC+3) by default. You can change this in db_connect.php by modifying the timezone setting. Both PHP and MySQL timezones should match for correct election timing.

### WebSocket Port
The default WebSocket port is 8080. To change it, update both server.php and websocket-client.js with the new port number. Ensure the new port is open in your firewall configuration.

### Database Credentials
Update the database host, name, username, and password in db_connect.php to match your MySQL server settings.

## Production Deployment

### Pre-Deployment Checklist
Change all default passwords before going live. Update database credentials for production server. Configure SSL/TLS for secure HTTPS connections. Use secure WebSocket (WSS) instead of plain WebSocket. Set up a process manager to keep the WebSocket server running. Configure firewall rules to allow only necessary ports. Enable error logging but disable debug output. Set up regular database backups.

### Process Management
Use a process manager like systemd or supervisor to ensure the WebSocket server stays running. Configure automatic restart if the server crashes. Monitor server logs for errors and unusual activity.

### Security Hardening
Enable HTTPS for all connections. Use secure session configuration in PHP. Implement rate limiting for login attempts. Regularly update PHP, MySQL, and dependencies. Keep the WebSocket server behind a reverse proxy if possible.

## Maintenance

### Regular Tasks
Monitor the WebSocket server to ensure it is running properly. Check database performance and optimize tables periodically. Review error logs weekly to identify issues. Backup the database regularly, especially before major elections. Update dependencies when security patches are available.

### Database Maintenance
Periodically clean up old election data to keep the database size manageable. Optimize database tables to maintain performance. Monitor disk space usage. Test backup restoration procedures regularly.

### Log Management
Review debug logs for errors and warnings. Rotate log files to prevent them from growing too large. Archive old logs for historical reference.

## Known Limitations

The WebSocket server must run continuously for real-time features to work. Only one WebSocket server instance can run at a time. Real-time updates require an active WebSocket connection. Users must re-login if their session expires. Votes cannot be edited or changed after submission. The system does not support clustering or load balancing for the WebSocket server.

## Future Enhancements

Potential improvements include email notifications when elections start or end. Export election results to PDF format. Support for different election types like referendums or ranked choice voting. Add candidate profile pictures and detailed bios. Implement vote verification receipts for transparency. Create analytics dashboards for election statistics. Develop a mobile application for easier access. Add multi-language support for international users.

## Support and Documentation

For technical issues, check the debug_log.txt file for detailed error information. Review the browser console for client-side JavaScript errors. Verify all prerequisites are installed and configured correctly. Ensure file permissions are set correctly on the server. Check that all required files are present and properly uploaded.

## Version Information

This is version 1.0 of the Online Election System. It includes basic voting functionality, administrative tools for election management, real-time updates via WebSocket, session-based authentication, and role-based access control.

## Credits and Technology

The system is built using PHP for server-side processing, MySQL for database management, JavaScript for client-side interactivity, Ratchet library for WebSocket implementation, and standard HTML and CSS for the user interface.

## License

This project is developed for educational purposes at Mbarara University of Science and Technology.
