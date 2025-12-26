document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard script loaded');
    
    const userRole = sessionStorage.getItem('userRole');
    const username = sessionStorage.getItem('username');

    const studentDashboard = document.getElementById('student-dashboard');
    const adminDashboard = document.getElementById('admin-dashboard');
    const roleDisplay = document.getElementById('user-role-display');
    const logoutButton = document.getElementById('logout-button');

    // Security Check
    if (!userRole || !username) {
        alert('Access Denied. Please log in.');
        window.location.href = 'index.html';
        return;
    }

    // Display Role and Content
    roleDisplay.textContent = `User: ${username} | Role: ${userRole.toUpperCase()}`;

    // INITIALIZE WEBSOCKET 
    if (typeof window.wsClient !== 'undefined') {
        console.log('Initializing WebSocket connection...');
        
        // Set up WebSocket event handlers
        
        window.wsClient.on('authenticated', (data) => {
            const userRole = sessionStorage.getItem('userRole');
            console.log('WebSocket authenticated as ${userRole}');
            showNotification('Connected to real-time updates', 'success');
        });

        window.wsClient.on('vote_notification', (data) => {
            console.log('Vote notification received:', data);
            if (userRole === 'admin') {
                // The server sends vote_notification on a new vote
                showNotification(`New vote cast in election ${data.election_id}`, 'info');
                // Admins should refresh the results section immediately
                refreshCurrentElectionResults(data.election_id);
            }
        });

        window.wsClient.on('live_results', (data) => {
            console.log('Live results update received:', data);
            // The server sends live_results when results change (including after a vote_notification)
            updateLiveResults(data);
        });

        window.wsClient.on('election_status_change', (data) => {
            console.log('Election status update:', data);
            // The server sends election_status_change on cancel/start/end events
            showNotification(data.message, 'info');
            // Force a reload to reflect the change in navigation menus and content
            window.location.reload(); 
        });

        window.wsClient.on('error', (data) => {
            console.error('WebSocket error:', data.message);
        });

        // Connect if not already connected (the client attempts to connect automatically, this is a safeguard)
        if (!window.wsClient.isConnected()) {
            window.wsClient.connect();
        }
    }

    // Initialize Dashboard based on Role
    if (userRole === 'student') {
        studentDashboard.style.display = 'block';
        adminDashboard.style.display = 'none';
        handleStudentRouting();
    } else if (userRole === 'admin') {
        studentDashboard.style.display = 'none';
        adminDashboard.style.display = 'block';
        handleAdminRouting();
    }

    // Logout Functionality
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            // Disconnect WebSocket
            if (window.wsClient) {
                window.wsClient.disconnect();
            }
            sessionStorage.clear();
            window.location.href = 'index.html';
        });
    }

    // NOTIFICATION SYSTEM 
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        let bgColor;
        switch(type) {
            case 'success': bgColor = '#28a745'; break;
            case 'error': bgColor = '#dc3545'; break;
            default: bgColor = '#17a2b8';
        }
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${bgColor};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in'; 
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    //  CSS for notification animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    //  LIVE RESULTS UPDATE (Real-time DOM manipulation) 
    function updateLiveResults(data) {
        // Targets the results container with the matching data-election-id attribute
        const resultsContainer = document.querySelector(`.results-display[data-election-id="${data.election_id}"]`);
        
        if (resultsContainer) {
            const totalVotesEl = resultsContainer.querySelector('.total-votes strong');
            if (totalVotesEl) {
                totalVotesEl.textContent = `Total Votes: ${data.total_votes}`;
            }

            // Update each candidate's vote count
            if (data.results && data.results.candidates) {
                data.results.candidates.forEach(candidate => {
                    // Targets the table row with the matching data-candidate-id
                    const candidateRow = resultsContainer.querySelector(`tr[data-candidate-id="${candidate.candidate_id}"]`);
                    if (candidateRow) {
                        const voteCountEl = candidateRow.querySelector('.vote-count');
                        const percentageEl = candidateRow.querySelector('.vote-percentage');
                        
                        if (voteCountEl) {
                            voteCountEl.textContent = candidate.vote_count;
                        }
                        
                        if (percentageEl && data.total_votes > 0) {
                            const percentage = ((candidate.vote_count / data.total_votes) * 100).toFixed(1);
                            percentageEl.textContent = `${percentage}%`;
                        }
                    }
                });
            }
        }
    }

    // REFRESH CURRENT ELECTION RESULTS (Triggers live_results from server) 
    function refreshCurrentElectionResults(electionId) {
        // This is only called for admins when a new vote notification is received
        if (userRole === 'admin' && window.wsClient && window.wsClient.isAuthenticated()) {
            // Request the latest results from the server which will then send a 'live_results' event
            window.wsClient.requestLiveResults(electionId);
        }
    }

    function handleStudentRouting() {
        const contentArea = document.getElementById('student-content-area');
        
        if (!contentArea) {
            console.error('Student content area not found!');
            return;
        }
        
        function loadStudentContent() {
            const hash = window.location.hash.substring(1); 
            console.log('Loading student section:', hash);
            
            try {
                switch(hash) {
                    case 'upcoming':
                        loadUpcomingElections(contentArea);
                        break;
                    case 'active':
                        loadActiveElections(contentArea);
                        break;
                    case 'results':
                        loadResultsForStudent(contentArea);
                        break;
                    default:
                        contentArea.innerHTML = '<h3>Welcome! Select an action above.</h3>';
                }
            } catch (error) {
                console.error('Error in loadStudentContent:', error);
                contentArea.innerHTML = `
                    <div style="padding: 20px; background: #fee; border: 2px solid #c00; border-radius: 8px;">
                        <h3>Error</h3>
                        <p>${error.message}</p>
                    </div>
                `;
            }
        }
        
        window.addEventListener('hashchange', loadStudentContent);
        
        const studentLinks = studentDashboard.querySelectorAll('.dashboard-actions a[href^="#"]');
        
        studentLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault(); 
                window.location.hash = this.getAttribute('href');
            });
        });
        
        if (window.location.hash) {
            loadStudentContent();
        }
    }

    function handleAdminRouting() {
        const contentArea = document.getElementById('admin-content-area');
        
        if (!contentArea) {
            console.error('Admin content area not found!');
            return;
        }
        
        function loadAdminContent() {
            const hash = window.location.hash.substring(1);
            console.log('Loading admin section:', hash);
            
            try {
                switch(hash) {
                    case 'create-election':
                        loadCreateElectionForm(contentArea);
                        break;
                    case 'upcoming-admin':
                        loadUpcomingElectionsAdmin(contentArea);
                        break;
                    case 'active-admin':
                        loadActiveElectionsAdmin(contentArea);
                        break;
                    case 'results-admin':
                        loadResultsForAdmin(contentArea);
                        break;
                    default:
                        contentArea.innerHTML = '<h3>Manage the election system. Select an action above.</h3>';
                }
            } catch (error) {
                console.error('Error in loadAdminContent:', error);
                contentArea.innerHTML = `
                    <div style="padding: 20px; background: #fee; border: 2px solid #c00; border-radius: 8px;">
                        <h3>Error</h3>
                        <p>${error.message}</p>
                    </div>
                `;
            }
        }
        
        window.addEventListener('hashchange', loadAdminContent);
        
        const adminLinks = adminDashboard.querySelectorAll('.dashboard-actions a[href^="#"]');
        
        adminLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                window.location.hash = this.getAttribute('href');
            });
        });
        
        if (window.location.hash) {
            loadAdminContent();
        }
    }
    
    // LOAD ACTIVE ELECTIONS (STUDENT)
    async function loadActiveElections(contentArea) {
        console.log('loadActiveElections called');
        contentArea.innerHTML = '<p style="text-align: center; padding: 20px;">⏳ Loading active elections...</p>';
        
        try {
            const response = await fetch('get_elections.php?status=active', { credentials: 'include' });
            const responseText = await response.text();
            let data;
            try { data = JSON.parse(responseText); } catch (e) { throw new Error('Invalid server response'); }
            if (!response.ok) { throw new Error(data.message || 'Failed to load elections'); }
            
            if (data.elections && data.elections.length > 0) {
                const electionIds = data.elections.map(e => e.election_id).join(',');
                let votedElections = [];
                try {
                    const voteStatusResponse = await fetch(`check_vote_status.php?election_ids=${electionIds}`, { credentials: 'include' });
                    if (voteStatusResponse.ok) {
                        const voteStatusData = await voteStatusResponse.json();
                        votedElections = voteStatusData.voted_elections || [];
                    }
                } catch (e) { console.error('Error checking vote status:', e); }
                
                let html = '<h3> Active Elections - Vote Now</h3>';
                
                data.elections.forEach(election => {
                    const hasVoted = votedElections.includes(parseInt(election.election_id));
                    html += renderElectionVotingInterface(election, hasVoted);
                });
                
                contentArea.innerHTML = html;
                
                setTimeout(() => {
                    initializeVotingForms();
                }, 100);
            } else {
                contentArea.innerHTML = `<h3>Active Elections</h3><div style="padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;"><p style="font-size: 18px; color: #6c757d;">No active elections at this time.</p><p style="margin-top: 10px;">Check back later or view upcoming elections.</p></div>`;
            }
        } catch (error) {
            contentArea.innerHTML = `<div style="padding: 20px; background: #fee; border: 2px solid #c00; border-radius: 8px;"><h3>Error loading elections</h3><p><strong>Error:</strong> ${error.message}</p><p style="margin-top: 10px; font-size: 12px; color: #666;">Check console for details (F12)</p></div>`;
        }
    }

    //  LOAD UPCOMING ELECTIONS (STUDENT)
    async function loadUpcomingElections(contentArea) {
        contentArea.innerHTML = '<p style="text-align: center; padding: 20px;"> Loading upcoming elections...</p>';
        
        try {
            const response = await fetch('get_elections.php?status=upcoming', { credentials: 'include' });
            const responseText = await response.text();
            let data;
            try { data = JSON.parse(responseText); } catch (e) { throw new Error('Invalid server response'); }
            if (!response.ok) { throw new Error(data.message || 'Failed to load elections'); }
            
            if (data.elections && data.elections.length > 0) {
                let html = '<h3> Upcoming Elections</h3>';
                data.elections.forEach(election => {
                    html += renderElectionCard(election, 'upcoming');
                });
                contentArea.innerHTML = html;
            } else {
                contentArea.innerHTML = `<h3>Upcoming Elections</h3><div style="padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;"><p style="font-size: 18px; color: #6c757d;">No upcoming elections at this time.</p></div>`;
            }
        } catch (error) {
            contentArea.innerHTML = `<div style="padding: 20px; background: #fee; border: 2px solid #c00; border-radius: 8px;"><h3>Error</h3><p>${error.message}</p></div>`;
        }
    }

    // LOAD RESULTS (STUDENT) 
    async function loadResultsForStudent(contentArea) {
        contentArea.innerHTML = '<p style="text-align: center; padding: 20px;">⏳ Loading election results...</p>';
        
        try {
            const response = await fetch('get_elections.php?status=completed', { credentials: 'include' });
            const responseText = await response.text();
            let data;
            try { data = JSON.parse(responseText); } catch (e) { throw new Error('Invalid server response'); }
            if (!response.ok) { throw new Error(data.message || 'Failed to load results'); }
            
            if (data.elections && data.elections.length > 0) {
                let html = '<h3> Election Results</h3>';
                for (const election of data.elections) {
                    html += await renderElectionResults(election);
                }
                contentArea.innerHTML = html;
            } else {
                contentArea.innerHTML = `<h3> Election Results</h3><div style="padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;"><p style="font-size: 18px; color: #6c757d;">No completed elections yet.</p></div>`;
            }
        } catch (error) {
            contentArea.innerHTML = `<div style="padding: 20px; background: #fee; border: 2px solid #c00; border-radius: 8px;"><h3>Error</h3><p>${error.message}</p></div>`;
        }
    }

    //  ADMIN FUNCTIONS 
    async function loadActiveElectionsAdmin(contentArea) {
        contentArea.innerHTML = '<p style="text-align: center; padding: 20px;">⏳ Loading active elections...</p>';
        
        try {
            const response = await fetch('get_elections.php?status=active', { credentials: 'include' });
            const data = JSON.parse(await response.text());
            
            if (!response.ok) throw new Error(data.message || 'Failed to load elections');
            
            if (data.elections && data.elections.length > 0) {
                let html = '<h3> Active Elections</h3>';
                data.elections.forEach(election => {
                    html += renderElectionCard(election, 'active', true);
                });
                contentArea.innerHTML = html;
            } else {
                contentArea.innerHTML = `<h3> Active Elections</h3><div style="padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;"><p>No active elections at this time.</p></div>`;
            }
        } catch (error) {
            contentArea.innerHTML = `<div style="padding: 20px; background: #fee; border: 2px solid #c00; border-radius: 8px;"><h3>Error</h3><p>${error.message}</p></div>`;
        }
    }

    async function loadCreateElectionForm(contentArea) {
        console.log('Loading create election form...');
        contentArea.innerHTML = '<p style="text-align: center; padding: 20px;">⏳ Loading form...</p>';
        
        try {
            const response = await fetch('create_election_form.html');
            if (!response.ok) throw new Error(`Failed to load form: ${response.status}`);
            
            const html = await response.text();
            contentArea.innerHTML = html;
            
            setTimeout(() => {
                if (typeof window.initCreateElectionForm === 'function') {
                    console.log('Initializing form...');
                    window.initCreateElectionForm();
                } else {
                    console.error('initCreateElectionForm not found - Ensure it is loaded.');
                }
            }, 150);
            
        } catch (error) {
            contentArea.innerHTML = `<div style="padding: 20px; background: #fee; border: 2px solid #c00; border-radius: 8px;"><h3>❌ Error Loading Form</h3><p>${error.message}</p></div>`;
        }
    }

    async function loadUpcomingElectionsAdmin(contentArea) {
        contentArea.innerHTML = '<p style="text-align: center; padding: 20px;">⏳ Loading...</p>';
        
        try {
            const response = await fetch('get_elections.php?status=upcoming', { credentials: 'include' });
            const data = JSON.parse(await response.text());
            
            if (!response.ok) throw new Error(data.message || 'Failed to load elections');
            
            if (data.elections && data.elections.length > 0) {
                let html = '<h3> Manage Upcoming Elections</h3>';
                data.elections.forEach(election => {
                    html += renderElectionCard(election, 'upcoming', true);
                });
                contentArea.innerHTML = html;
            } else {
                contentArea.innerHTML = `<h3> Manage Upcoming Elections</h3><div style="padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;"><p>No upcoming elections.</p></div>`;
            }
        } catch (error) {
            contentArea.innerHTML = `<div style="padding: 20px; background: #fee; border: 2px solid #c00; border-radius: 8px;"><h3>Error</h3><p>${error.message}</p></div>`;
        }
    }

    async function loadResultsForAdmin(contentArea) {
        contentArea.innerHTML = '<p style="text-align: center; padding: 20px;">⏳ Loading results...</p>';
        
        try {
            const response = await fetch('get_elections.php?status=completed', { credentials: 'include' });
            const data = JSON.parse(await response.text());
            
            if (!response.ok) throw new Error(data.message || 'Failed to load results');
            
            if (data.elections && data.elections.length > 0) {
                let html = '<h3>📋 View and Certify Results</h3>';
                for (const election of data.elections) {
                    html += await renderElectionResults(election, true); 
                }
                contentArea.innerHTML = html;
            } else {
                contentArea.innerHTML = `<h3>📋 View and Certify Results</h3><div style="padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;"><p>No completed elections.</p></div>`;
            }
        } catch (error) {
            contentArea.innerHTML = `<div style="padding: 20px; background: #fee; border: 2px solid #c00; border-radius: 8px;"><h3>Error</h3><p>${error.message}</p></div>`;
        }
    }

    // RENDER ELECTION CARD
    function renderElectionCard(election, status, isAdmin = false) {
        const startDate = new Date(election.start_time).toLocaleString();
        const endDate = new Date(election.end_time).toLocaleString();
        const candidateCount = election.candidate_count || 0;
        const isCancelled = election.status === 'cancelled';
        
        return `
            <div style="margin-bottom: 20px; padding: 20px; background: white; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); ${isCancelled ? 'opacity: 0.6;' : ''}">
                <h4 style="margin-top: 0; color: #007bff;">${escapeHtml(election.title)} ${isCancelled ? '<span style="color: #dc3545;">[CANCELLED]</span>' : ''}</h4>
                ${election.description ? `<p style="color: #666;">${escapeHtml(election.description)}</p>` : ''}
                <p><strong>Start:</strong> ${startDate}</p>
                <p><strong>End:</strong> ${endDate}</p>
                <p><strong>Candidates:</strong> ${candidateCount}</p>
                ${isAdmin && !isCancelled && (status === 'upcoming' || status === 'active') ? `
                    <button onclick="cancelElection(${election.election_id}, '${escapeHtml(election.title)}')" 
                            style="margin-top: 10px; padding: 8px 15px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
                         Cancel Election
                    </button>
                ` : ''}
            </div>
        `;
    }

    // ===== HELPER: RENDER VOTING INTERFACE (from dashboard1.js) =====
    function renderElectionVotingInterface(election, hasVoted = false) {
        const endDate = new Date(election.end_time).toLocaleString();
        const isCancelled = election.status === 'cancelled';
        
        if (hasVoted || isCancelled) {
            return `
                <div class="voting-container" style="margin-bottom: 30px; padding: 20px; background: #f8f9fa; border: 2px solid #ddd; border-radius: 8px;">
                    <h3 style="margin-top: 0; color: #007bff;">${escapeHtml(election.title)}</h3>
                    <p style="color: #666;">Voting Ends: ${endDate}</p>
                    <div style="padding: 20px; text-align: center; background: #d4edda; border: 2px solid #c3e6cb; border-radius: 4px;">
                        ${hasVoted ? `
                            <h4 style="color: #155724;"> You have already voted</h4>
                            <p style="color: #155724;">Thank you for participating!</p>
                        ` : `
                            <h4 style="color: #721c24;"> This election has been cancelled</h4>
                        `}
                    </div>
                </div>
            `;
        }
        
        let candidatesHtml = '';
        if (election.candidates && election.candidates.length > 0) {
            election.candidates.forEach(candidate => {
                candidatesHtml += `
                    <div class="candidate-card" data-candidate-id="${candidate.candidate_id}" 
                         style="margin: 15px 0; padding: 15px; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; transition: all 0.3s; background: white;">
                        <input type="radio" id="candidate_${election.election_id}_${candidate.candidate_id}" 
                               name="vote_${election.election_id}" value="${candidate.candidate_id}" required
                               style="margin-right: 10px;">
                        <label for="candidate_${election.election_id}_${candidate.candidate_id}" 
                               style="cursor: pointer; display: flex; align-items: center; width: 100%;">
                            <div class="candidate-info" style="flex: 1;">
                                <h4 style="margin: 0 0 5px 0;">${escapeHtml(candidate.name)}</h4>
                                ${candidate.manifesto ? `<p style="margin: 0; color: #666;">${escapeHtml(candidate.manifesto)}</p>` : ''}
                            </div>
                        </label>
                    </div>
                `;
            });
        }
        
        return `
            <div class="voting-container" style="margin-bottom: 30px; padding: 20px; background: white; border: 1px solid #ddd; border-radius: 8px;">
                <h3 style="margin-top: 0; color: #007bff;">${escapeHtml(election.title)}</h3>
                <p style="color: #666;">Voting Ends: ${endDate}</p>
                ${election.description ? `<p style="color: #555;">${escapeHtml(election.description)}</p>` : ''}
                
                <form class="voting-form" data-election-id="${election.election_id}">
                    <p style="font-weight: bold; margin: 15px 0;">Select one candidate to cast your vote:</p>
                    <div class="candidates-list">${candidatesHtml}</div>
                    
                    <div style="margin-top: 20px; text-align: center;">
                        <button type="submit" class="confirm-vote-btn" 
                                style="padding: 12px 30px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: bold;">
                            Cast My Vote Securely
                        </button>
                    </div>
                    
                    <p class="voting-message" style="margin-top: 15px; text-align: center; color: red; display: none;"></p>
                </form>
            </div>
        `;
    }

    // RENDER RESULTS ( FOR REAL-TIME HOOKS) 
    async function renderElectionResults(election, isAdmin = false) {
        try {
            const response = await fetch(`get_results.php?id=${election.election_id}`, { credentials: 'include' });
            const resultsData = JSON.parse(await response.text());
            
            if (!response.ok || !resultsData.results) {
                return `<div style="margin-bottom: 20px; padding: 20px; background: white; border: 1px solid #ddd; border-radius: 8px;"><h4>${escapeHtml(election.title)}</h4><p>No results available.</p></div>`;
            }
            
            const results = resultsData.results;
            const totalVotes = resultsData.total_votes || 0;
            
            // Add the results-display class and data attribute for the real-time updateLiveResults function
            let html = `
                <div class="results-display" data-election-id="${election.election_id}" 
                     style="margin-bottom: 30px; padding: 20px; background: white; border: 1px solid #ddd; border-radius: 8px;">
                    <h4 style="margin-top: 0; color: #007bff;">${escapeHtml(election.title)}</h4>
                    <p style="color: #666;"><strong class="total-votes">Total Votes: ${totalVotes}</strong></p>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Candidate</th>
                                <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Votes</th>
                                <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">%</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            results.forEach((result, index) => {
                const percentage = totalVotes > 0 ? ((result.vote_count / totalVotes) * 100).toFixed(1) : 0;
                const isWinner = index === 0 && result.vote_count > 0;
                
                html += `
                    <tr data-candidate-id="${result.candidate_id}" style="${isWinner ? 'background: #d4edda;' : ''}">
                        <td style="padding: 10px; border: 1px solid #ddd;">
                            ${escapeHtml(result.name)}
                            ${isWinner ? ' <span style="color: #28a745; font-weight: bold;">🏆 Winner</span>' : ''}
                        </td>
                        <td class="vote-count" style="padding: 10px; text-align: center; border: 1px solid #ddd;">${result.vote_count}</td>
                        <td class="vote-percentage" style="padding: 10px; text-align: center; border: 1px solid #ddd;">${percentage}%</td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            return html;
        } catch (error) {
            return `<div style="margin-bottom: 20px; padding: 20px; background: white; border: 1px solid #ddd; border-radius: 8px;"><h4>${escapeHtml(election.title)}</h4><p style="color: red;">Error loading results</p></div>`;
        }
    }

    // INITIALIZE VOTING FORMS 
    function initializeVotingForms() {
        console.log('Initializing voting forms...');
        const votingForms = document.querySelectorAll('.voting-form');
        
        const candidateCards = document.querySelectorAll('.candidate-card');
        candidateCards.forEach(card => {
            card.addEventListener('click', function(e) {
                if (e.target.type !== 'radio') {
                    const radio = this.querySelector('input[type="radio"]');
                    if (radio) {
                        radio.checked = true;
                        radio.dispatchEvent(new Event('change'));
                    }
                }
            });
            
            const radio = card.querySelector('input[type="radio"]');
            if (radio) {
                radio.addEventListener('change', function() {
                    const form = this.closest('.voting-form');
                    if (form) {
                        form.querySelectorAll('.candidate-card').forEach(c => {
                            c.style.border = '2px solid #ddd';
                            c.style.background = 'white';
                        });
                    }
                    if (this.checked) {
                        card.style.border = '2px solid #007bff';
                        card.style.background = '#f0f8ff';
                    }
                });
            }
        });
        
        // Add submit handlers
        votingForms.forEach(form => {
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const electionId = this.getAttribute('data-election-id');
                const selectedVote = this.querySelector(`input[name="vote_${electionId}"]:checked`);
                const messageEl = this.querySelector('.voting-message');
                const submitBtn = this.querySelector('.confirm-vote-btn');
                
                if (!selectedVote) {
                    if (messageEl) {
                        messageEl.textContent = 'Please select a candidate.';
                        messageEl.style.display = 'block';
                    }
                    return;
                }
                
                submitBtn.disabled = true;
                if (messageEl) messageEl.style.display = 'none';
                
                try {
                    const response = await fetch('cast_vote.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            election_id: electionId,
                            candidate_id: selectedVote.value
                        })
                    });
                    
                    const responseText = await response.text();
                    let data;
                    try { data = JSON.parse(responseText); } catch (e) { throw new Error('Invalid server response'); }

                    if (response.ok) {
                        //  NOTIFY WEBSOCKET
                        if (window.wsClient && window.wsClient.isAuthenticated()) {
                            window.wsClient.notifyVoteCast(electionId);
                        }
                        
                        const container = this.closest('.voting-container');
                        if (container) {
                            container.innerHTML = `
                                <div style="text-align: center; padding: 40px;">
                                    <h3 style="color: #28a745;"> Vote Confirmed!</h3>
                                    <p style="font-size: 18px; margin: 20px 0;">${data.message || 'Your vote has been securely cast.'}</p>
                                    <p style="color: #666;">Thank you for participating!</p>
                                    <p id="countdown" style="margin-top: 20px; color: #999;">Reloading in 5 seconds...</p>
                                </div>
                            `;
                            
                            let seconds = 5;
                            const countdownEl = container.querySelector('#countdown');
                            const interval = setInterval(() => {
                                seconds--;
                                if (countdownEl) {
                                    countdownEl.textContent = `Reloading in ${seconds} seconds...`;
                                }
                                if (seconds <= 0) {
                                    clearInterval(interval);
                                    window.location.reload();
                                }
                            }, 1000);
                        }
                    } else {
                        if (messageEl) {
                            messageEl.textContent = data.message || `Voting failed (Error ${response.status})`;
                            messageEl.style.display = 'block';
                            messageEl.style.color = 'red';
                        }
                        submitBtn.disabled = false;
                    }
                } catch (error) {
                    console.error('Error casting vote:', error);
                    if (messageEl) {
                        messageEl.textContent = 'Network error. Please try again.';
                        messageEl.style.display = 'block';
                        messageEl.style.color = 'red';
                    }
                    submitBtn.disabled = false;
                }
            });
        });
    }

    // HELPER: ESCAPE HTML 
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ===== CANCEL ELECTION (ADMIN)
    async function cancelElection(electionId, electionTitle) {
        if (!confirm(`Are you sure you want to cancel "${electionTitle}"? This cannot be undone.`)) {
            return;
        }
        
        try {
            console.log('Cancelling election:', electionId);
            const response = await fetch('cancel_election.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ election_id: electionId })
            });
            
            const data = JSON.parse(await response.text());
            
            if (response.ok) {
                alert(data.message || 'Election cancelled successfully.');
                
                // NOTIFY WEBSOCKET // The client sends an 'election_update' event to the server
                if (window.wsClient && window.wsClient.isAuthenticated()) {
                    window.wsClient.notifyElectionUpdate({
                        election_id: electionId, 
                        status: 'cancelled', 
                        message: `Election '${electionTitle}' was CANCELLED by an administrator.`
                    });
                }
                
                // Reload content to update current view
                window.location.reload();
            } else {
                alert(data.message || 'Failed to cancel election.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while cancelling the election.');
        }
    }
    
    // Make cancelElection available globally for onclick in HTML
    window.cancelElection = cancelElection;
});