// websocket-client.js - Client-side WebSocket handler

class ElectionWebSocketClient {
    constructor(url = 'ws://localhost:8080') {
        this.url = url;
        this.ws = null;
        this.authenticated = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.messageHandlers = {};
    }

    // Connect to WebSocket server
    connect() {
        console.log('Connecting to WebSocket server...');
        
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log(' WebSocket connected');
            this.reconnectAttempts = 0;
            this.authenticate();
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.authenticated = false;
            this.attemptReconnect();
        };
    }

    // Authenticate with session ID
    authenticate() {
        const sessionId = this.getSessionId();
        
        if (!sessionId) {
            console.error('No session ID found');
            return;
        }

        this.send({
            type: 'authenticate',
            session_id: sessionId
        });
    }

    // Get PHP session ID from cookie
    getSessionId() {
        const name = 'PHPSESSID=';
        const decodedCookie = decodeURIComponent(document.cookie);
        const cookies = decodedCookie.split(';');
        
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.indexOf(name) === 0) {
                return cookie.substring(name.length);
            }
        }
        
        return null;
    }

    // Send message to server
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.error('WebSocket is not connected');
        }
    }

    // Handle incoming messages
    handleMessage(data) {
        console.log('WebSocket message received:', data);

        switch(data.type) {
            case 'auth_success':
                this.authenticated = true;
                console.log('✅ Authenticated:', data.role);
                this.trigger('authenticated', data);
                break;

            case 'vote_notification':
                this.trigger('vote_cast', data);
                break;

            case 'live_results':
                this.trigger('results_update', data);
                break;

            case 'election_status_change':
                this.trigger('election_update', data);
                break;

            case 'error':
                console.error('WebSocket error:', data.message);
                this.trigger('error', data);
                break;

            default:
                console.log('Unknown message type:', data.type);
        }
    }

    // Notify server about vote cast
    notifyVoteCast(electionId) {
        this.send({
            type: 'vote_cast',
            election_id: electionId
        });
    }

    // Request live results (admin only)
    requestLiveResults(electionId) {
        this.send({
            type: 'request_live_results',
            election_id: electionId
        });
    }

    // Notify about election status change (admin only)
    notifyElectionUpdate(electionId, status, message) {
        this.send({
            type: 'election_update',
            election_id: electionId,
            status: status,
            message: message
        });
    }

    // Register event handler
    on(event, handler) {
        if (!this.messageHandlers[event]) {
            this.messageHandlers[event] = [];
        }
        this.messageHandlers[event].push(handler);
    }

    // Trigger event handlers
    trigger(event, data) {
        if (this.messageHandlers[event]) {
            this.messageHandlers[event].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('Error in event handler:', error);
                }
            });
        }
    }

    // Attempt to reconnect
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

        setTimeout(() => {
            this.connect();
        }, this.reconnectDelay);
    }

    // Disconnect
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    // Check if connected
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    // Check if authenticated
    isAuthenticated() {
        return this.authenticated;
    }
}

// Create global WebSocket client instance
window.wsClient = new ElectionWebSocketClient('ws://localhost:8080');

// Auto-connect when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Only connect if user is logged in
    const userRole = sessionStorage.getItem('userRole');
    if (userRole) {
        console.log('Auto-connecting WebSocket...');
        window.wsClient.connect();
    }
});