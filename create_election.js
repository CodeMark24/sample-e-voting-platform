// create_election.js - FIXED VERSION (Correct API Path and Error Handling)

// Global init function that can be called when form is loaded dynamically
window.initCreateElectionForm = function() {
    console.log('initCreateElectionForm called');
    
    const addCandidateBtn = document.getElementById('addCandidateBtn');
    const candidatesList = document.getElementById('candidates-list');
    const candidateCountInput = document.getElementById('candidateCount');
    
    // Check if elements exist before proceeding
    if (!addCandidateBtn || !candidatesList || !candidateCountInput) {
        console.error('Create election form elements not found!');
        console.log('addCandidateBtn:', addCandidateBtn);
        console.log('candidatesList:', candidatesList);
        console.log('candidateCountInput:', candidateCountInput);
        return false;
    }
    
    console.log(' All form elements found, initializing...');
    
    let candidateCounter = parseInt(candidateCountInput.value, 10) || 0;
    
    // Update placeholder visibility
    function updatePlaceholderVisibility() {
        const placeholder = candidatesList.querySelector('.placeholder-text');
        const candidateEntries = candidatesList.querySelectorAll('.candidate-entry');
        
        if (candidateEntries.length > 0) {
            if (placeholder) placeholder.style.display = 'none';
        } else {
            if (placeholder) placeholder.style.display = 'block';
        }
    }
    
    // Add candidate entry
    function addCandidateEntry() {
        candidateCounter++;
        candidateCountInput.value = candidateCounter;

        const entryDiv = document.createElement('div');
        entryDiv.classList.add('candidate-entry');
        entryDiv.dataset.id = candidateCounter;

        entryDiv.innerHTML = `
            <div class="input-group">
                <label for="candidateName_${candidateCounter}">Candidate ${candidateCounter} Name</label>
                <input type="text" id="candidateName_${candidateCounter}" name="candidateName[]" placeholder="Full Name" required>
            </div>
            <div class="input-group">
                <label for="candidateManifesto_${candidateCounter}">Manifesto/Position (Optional)</label>
                <input type="text" id="candidateManifesto_${candidateCounter}" name="candidateManifesto[]" placeholder="Short description or link">
            </div>
            <button type="button" class="remove-candidate-btn" data-id="${candidateCounter}">
                Remove
            </button>
        `;

        candidatesList.appendChild(entryDiv);
        updatePlaceholderVisibility();
        console.log('Candidate entry added:', candidateCounter);
    }

    // Remove candidate entry
    function removeCandidateEntry(event) {
        if (event.target.classList.contains('remove-candidate-btn')) {
            const entryId = event.target.dataset.id;
            const entryToRemove = candidatesList.querySelector(`.candidate-entry[data-id="${entryId}"]`);
            
            if (entryToRemove) {
                candidatesList.removeChild(entryToRemove);
                updatePlaceholderVisibility();
                console.log('Candidate entry removed:', entryId);
            }
        }
    }

    // Event Listeners
    addCandidateBtn.addEventListener('click', addCandidateEntry);
    candidatesList.addEventListener('click', removeCandidateEntry);

    // Form Submission
    const createElectionForm = document.getElementById('createElectionForm');
    const formMessage = document.getElementById('form-message');

    if (createElectionForm) {
        createElectionForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            if (formMessage) {
                formMessage.style.display = 'none';
            }
            
            const submitButton = this.querySelector('.submit-btn');
            if (submitButton) submitButton.disabled = true;

            // Gather candidate data
            const candidateEntries = candidatesList.querySelectorAll('.candidate-entry');
            const candidates = [];

            candidateEntries.forEach(entry => {
                const nameInput = entry.querySelector('input[name="candidateName[]"]');
                const manifestoInput = entry.querySelector('input[name="candidateManifesto[]"]');
                
                if (nameInput && nameInput.value.trim() !== '') {
                    candidates.push({
                        name: nameInput.value.trim(),
                        manifesto: manifestoInput ? manifestoInput.value.trim() : ''
                    });
                }
            });

            // Validation
            if (candidates.length < 2) {
                if (formMessage) {
                    formMessage.textContent = 'An election must have at least two candidates.';
                    formMessage.style.display = 'block';
                    formMessage.style.color = 'red';
                }
                if (submitButton) submitButton.disabled = false;
                return;
            }

            // Build form data
            const formData = {
                electionTitle: document.getElementById('electionTitle').value,
                electionDescription: document.getElementById('electionDescription').value,
                startDate: document.getElementById('startDate').value,
                startTime: document.getElementById('startTime').value,
                endDate: document.getElementById('endDate').value,
                endTime: document.getElementById('endTime').value,
                candidates: candidates
            };

            console.log('Submitting election data:', formData);

            // API Call 
            let response = null;
            try {
                console.log('Fetching: create_election.php');
                response = await fetch('create_election.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                console.log('Response status:', response.status, response.statusText);

                // Read response as text first (can only read once)
                const responseText = await response.text();
                console.log('Response text (first 500 chars):', responseText.substring(0, 500));

                // Try to parse as JSON
                let data;
                try {
                    data = JSON.parse(responseText);
                    console.log('Server response (parsed):', data);
                } catch (jsonError) {
                    // Not valid JSON - likely a PHP error
                    console.error('Failed to parse JSON response:', jsonError);
                    console.error('Raw response:', responseText);
                    
                    if (formMessage) {
                        formMessage.textContent = `Server error (${response.status}): The server returned an error. Check browser console for details.`;
                        formMessage.style.color = 'red';
                        formMessage.style.display = 'block';
                    }
                    if (submitButton) submitButton.disabled = false;
                    return;
                }

                if (response.ok) {
                    if (formMessage) {
                        formMessage.textContent = data.message || 'Election created successfully!';
                        formMessage.style.color = 'green';
                        formMessage.style.display = 'block';
                    }
                    
                    // Reset form
                    createElectionForm.reset();
                    candidatesList.innerHTML = '<p class="placeholder-text">Click the button below to add candidates.</p>';
                    candidateCounter = 0;
                    candidateCountInput.value = 0;
                    
                } else {
                    if (formMessage) {
                        formMessage.textContent = data.message || `Failed to create election (Error ${response.status}).`;
                        formMessage.style.color = 'red';
                        formMessage.style.display = 'block';
                    }
                }

            } catch (error) {
                console.error('Error creating election:', error);
                console.error('Error stack:', error.stack);
                
                let errorMessage = 'Network error. Check server connection and console for details.';
                
                if (formMessage) {
                    formMessage.textContent = errorMessage;
                    formMessage.style.color = 'red';
                    formMessage.style.display = 'block';
                }
            } finally {
                if (submitButton) submitButton.disabled = false;
            }
        });
    }
    
    // Initialize placeholder visibility
    updatePlaceholderVisibility();
    
    console.log('Create election form initialized successfully');
    return true;
};

console.log('create_election.js loaded - waiting for manual initialization');