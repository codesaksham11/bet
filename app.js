// In app.js

// --- DOM Elements (Add nameInput) ---
// ... other elements
const nameInput = document.getElementById('name-input'); // Add this line
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
// ... rest of elements

 // --- Functions ---

 // ... updateUI, checkSession, modals etc. remain the same ...


    /**
     * Performs the actual login API call.
     * @param {string} name         <-- ADDED
     * @param {string} email
     * @param {string} password
     * @param {boolean} forceLogin - Flag to indicate if overriding an existing session.
     * @returns {Promise<Response>} The fetch response promise.
     */
    async function performLoginRequest(name, email, password, forceLogin = false) { // <-- Added name param
        const body = { name, email, password }; // <-- Include name in body
        if (forceLogin) {
            body.forceLogin = true;
        }
        // Don't log password or potentially sensitive name if logging body
        console.log(`Sending login request with forceLogin=${forceLogin}`, { name: body.name, email: body.email, forceLogin: body.forceLogin });

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body), // Body now includes name
            });
            console.log(`Login response status: ${response.status}`);
            return response;
        } catch (error) {
            console.error('Fetch error during login:', error);
            throw error;
        }
    }


    /**
     * Handles the login form submission.
     */
    async function handleLoginSubmit(event) {
        event.preventDefault();
        // Added nameInput check
        if (isLoginPending || !loginForm || !nameInput || !emailInput || !passwordInput || !loginSubmitBtn || !loginErrorMessage) {
            console.log('Login already in progress or elements missing.');
            return;
        }

        const name = nameInput.value.trim(); // <-- Get name value
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        // Check name presence as well
        if (!name || !email || !password) {
            resetLoginAttemptState('Please fill in all fields (Name, Email, Password).');
            return;
        }

        isLoginPending = true;
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.innerHTML = '<span class="icon">⏳</span> Verifying...';
        loginErrorMessage.textContent = 'Attempting login...';
        loginErrorMessage.style.display = 'block';

        pendingLoginDetails = { name, email, password }; // <-- Store name too
        console.log('Login attempt initiated for:', email, 'as Name:', name);

        try {
            // Pass name to performLoginRequest
            const response = await performLoginRequest(name, email, password, false);

            if (response.ok) {
                // If login is successful, the backend includes the name in session
                // checkSession will fetch verify-session which reads name from session
                console.log('Login successful');
                hideLoginModal();
                await checkSession();
            } else if (response.status === 401) {
                console.log('Login unauthorized (401)');
                resetLoginAttemptState('Invalid Email or Password.');
            } else if (response.status === 409) {
                console.log('Login conflict detected (409)');
                loginErrorMessage.textContent = 'Session conflict detected. Choose below.';
                loginErrorMessage.style.display = 'block';
                showConfirmationModal();
            } else {
                 let errorMsg = `Login failed (Status: ${response.status}).`;
                 try { const errorData = await response.json(); errorMsg = errorData.error || errorMsg; } catch(e) {}
                 console.error('Login failed with unexpected status:', response.status);
                 resetLoginAttemptState(errorMsg);
            }
        } catch (error) {
            console.error('Error during login request:', error);
            resetLoginAttemptState('A network error occurred. Please check your connection.');
        }
    }

     /**
     * Handles the forced login attempt after confirmation.
     */
     async function handleForcedLogin() {
         // Added nameInput check potentially? No, use pending details.
         if (!pendingLoginDetails || !confirmProceedBtn || !confirmCancelBtn) {
             // ... (rest of check is same)
             return;
         }
         // ... (rest of function setup is same)

         const { name, email, password } = pendingLoginDetails; // <-- Get name from pending details

         try {
             // Pass name to the force request
             const forceResponse = await performLoginRequest(name, email, password, true);
             // ... (rest of response handling is same)

         } catch (forceError) {
            // ... (error handling is same)
         } finally {
            // ... (finally block is same)
         }
     }

    // ... handleLogout, handleProceed etc. remain the same ...
