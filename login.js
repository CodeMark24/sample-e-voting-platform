// login.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');
    const loginButton = document.getElementById('loginButton');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    async function handleLogin(event) {
        event.preventDefault(); // Stop the form from submitting normally
        errorMessage.style.display = 'none';
        loginButton.disabled = true; // Disable button to prevent double-click

        const username = usernameInput.value.trim().toLowerCase();
        const password = passwordInput.value;
        
        //Input Validation
        if (username === '' || password === '') {
            errorMessage.textContent = 'Please enter both username and password.';
            errorMessage.style.display = 'block';
            loginButton.disabled = false;
            return;
        }

        //Fetch API Call to PHP Endpoint
        try {
            const response = await fetch('login.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                // Send credentials as a JSON body
                body: JSON.stringify({ 
                    username: username, 
                    password: password 
                })
            });

            const data = await response.json();
            
            if (response.ok) { 
                // Check for status 200 OK
                // Success: PHP successfully validated and set the session
                sessionStorage.setItem('userRole', data.role);
                sessionStorage.setItem('username', data.username);

                console.log(`Login successful. Redirecting to dashboard for role: ${data.role}`);
                window.location.href = 'dashboard.html';

            } else {
                // Failure: Status 401 Unauthorized or other error
                errorMessage.textContent = data.message || 'Login failed due to an unknown error.';
                errorMessage.style.display = 'block';
            }

        } catch (error) {
            console.error('Network or Server Error:', error);
            errorMessage.textContent = 'A network error occurred. Check your server connection.';
            errorMessage.style.display = 'block';
        } finally {
            loginButton.disabled = false; // Re-enable the button
        }
    }
});