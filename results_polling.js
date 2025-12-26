// results_polling.js

// Function to start the polling for a specific election ID
function startResultsPolling(electionId, targetElementId) {
    const targetElement = document.getElementById(targetElementId);
    let pollingInterval;

    // Function that fetches data from the PHP endpoint
    async function fetchResults() {
        try {
            const response = await fetch(`/get_results.php?id=${electionId}`);
            const data = await response.json();

            if (data.status === 'success') {
                renderResultsTable(data, targetElement);
            } else {
                targetElement.innerHTML = `<p class="error-message">Could not load results: ${data.message}</p>`;
                clearInterval(pollingInterval); // Stop polling on error
            }
        } catch (error) {
            console.error('Polling failed:', error);
        }
    }
    
    // Function to stop polling 
    function stopPolling() {
        clearInterval(pollingInterval);
    }
    
    // Initial fetch
    fetchResults();
    
    // Set up the recurring fetch every 5 seconds (Short Polling)
    pollingInterval = setInterval(fetchResults, 5000); // Poll every 5 seconds

    // Return the stop function so the main dashboard can clear the interval later
    return stopPolling;
}

// Function to render the results data into an HTML table
function renderResultsTable(data, targetElement) {
    let html = `
        <h3>Live Vote Tally (Total Votes: ${data.total_votes})</h3>
        <table class="results-table">
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Candidate Name</th>
                    <th>Votes</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.results.forEach((candidate, index) => {
        const percentage = data.total_votes > 0 
            ? ((candidate.vote_count / data.total_votes) * 100).toFixed(2) 
            : 0.00;
            
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${candidate.name}</td>
                <td><strong>${candidate.vote_count}</strong></td>
                <td>${percentage}%</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
        <p class="polling-status">Updated: ${new Date().toLocaleTimeString()} (Polling every 5s)</p>
    `;

    targetElement.innerHTML = html;
}