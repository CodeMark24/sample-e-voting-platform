// voting.js

document.addEventListener('DOMContentLoaded', () => {
    // NOTE: This code assumes the votingForm is dynamically loaded 
    
    const votingForm = document.getElementById('votingForm');
    const studentContentArea = document.getElementById('student-content-area');
    const votingMessage = document.getElementById('voting-message');

    if (votingForm) {
        votingForm.addEventListener('submit', handleVoteSubmission);
    }
    
    // 1. Vote Submission Handler (Real Fetch Call) 
    async function handleVoteSubmission(e) {
        e.preventDefault();
        votingMessage.style.display = 'none';
        
        const confirmVoteBtn = votingForm.querySelector('.confirm-vote-btn');
        confirmVoteBtn.disabled = true; // Disable button immediately

        const selectedVote = document.querySelector('input[name="vote"]:checked');

        if (!selectedVote) {
            votingMessage.textContent = 'Please select a candidate before casting your vote.';
            votingMessage.style.display = 'block';
            confirmVoteBtn.disabled = false;
            return;
        }

        const electionId = votingForm.getAttribute('data-election-id');
        const candidateId = selectedVote.value;
        
        // Fetch API Call to PHP Endpoint 
        try {
            const response = await fetch('cast_vote.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                // Send the required IDs as a JSON body
                body: JSON.stringify({ 
                    election_id: electionId, 
                    candidate_id: candidateId 
                })
            });

            const data = await response.json();
            
            if (response.ok) { // Status 200 OK
                // Success: PHP recorded the vote
                handleSuccessfulVote(data.message);

            } else {
                // Failure: Status 409 Conflict (Already Voted) or 403 Forbidden (Time Check)
                votingMessage.textContent = data.message || 'Voting failed due to an unknown issue.';
                votingMessage.style.display = 'block';
                confirmVoteBtn.disabled = false; // Re-enable if non-fatal error
            }

        } catch (error) {
            console.error('Network or Server Error:', error);
            votingMessage.textContent = 'A critical network error occurred during voting.';
            votingMessage.style.display = 'block';
            confirmVoteBtn.disabled = false;
        }
    }


    // --- 2. Confirmation & Redirection Logic ---
    function handleSuccessfulVote(successMessage) {
        //  IMPORTANT: Store a flag to ensure the student cannot access voting again
        // Note: The back-end is the true enforcer, this is a client-side speed bump.
        sessionStorage.setItem('voted_in_election_' + votingForm.getAttribute('data-election-id'), 'true');
        
        // Load the HTML content of the confirmation screen
        const confirmationHTML = `
            <div class="confirmation-container">
                <h2>✅ Vote Confirmed!</h2>
                <p class="confirmation-lead">${successMessage}</p>
                
                <div class="confirmation-details">
                    <p>Thank you for participating in the election process.</p>
                    <p><strong>Security Note:</strong> Your identity is protected, and this confirmation screen will automatically close to prevent re-voting or session misuse.</p>
                </div>

                <p id="countdown-message">Screen closing in 5 seconds...</p>
                
                <button class="action-btn primary-action disabled-btn" disabled>Voted</button>
            </div>
        `;

        // Replace the voting form content with the confirmation screen
        if (studentContentArea) {
            studentContentArea.innerHTML = confirmationHTML;
            
            // Start the countdown timer for closure/redirection
            startConfirmationCountdown(5);
        }
    }

    function startConfirmationCountdown(seconds) {
        const countdownElement = document.getElementById('countdown-message');
        let remainingSeconds = seconds;

        const countdownInterval = setInterval(() => {
            remainingSeconds--;
            countdownElement.textContent = `Screen closing in ${remainingSeconds} seconds...`;

            if (remainingSeconds <= 0) {
                clearInterval(countdownInterval);
                
                // This line forces a refresh or redirect to the clean dashboard state
                // to enforce the "cannot be opened again" rule on the front-end.
                window.location.reload(); 
            }
        }, 1000); // Update every second
    }

});