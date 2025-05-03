// /app.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("App JS Loaded - v2"); // Version marker for debugging

    // --- DOM Elements ---
    // Ensure all elements referenced here exist in index.html with the correct IDs
    const loginHeaderBtn = document.getElementById('login-header-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfoDiv = document.getElementById('user-info');
    const userNameSpan = document.getElementById('user-name');
    const proceedBtn = document.getElementById('proceed-btn');
    const proceedStatusMsg = document.getElementById('proceed-status-message');

    // Login Modal Elements
    const loginModalOverlay = document.getElementById('login-modal-overlay');
    const loginModalContent = document.getElementById('login-modal-content'); // Used? Maybe not directly needed
    const loginForm = document.getElementById('login-form');
    const nameInput = document.getElementById('name-input'); // Make sure this ID exists
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const loginSubmitBtn = document.getElementById('login-submit-btn');
    const loginErrorMessage = document.getElementById('login-error-message');
    const modalCloseBtn = document.getElementById('modal-close-btn'); // Make sure this ID exists

    // Confirmation Modal Elements
    const confirmationModalOverlay = document.getElementById('confirmation-modal-overlay');
    const confirmationModalContent = document.getElementById('confirmation-modal-content'); // Used? Maybe not directly needed
    const confirmProceedBtn = document.getElementById('confirm-proceed-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

    // --- State ---
    let isLoginPending = false;
    let pendingLoginDetails = null;
    // let isLoggedInState = false; // We'll rely directly on API checks more

    // --- Essential Check: Verify DOM Elements ---
    // Log errors if critical elements are missing, helps debugging!
    if (!loginHeaderBtn) console.error("#login-header-btn not found!");
    if (!logoutBtn) console.error("#logout-btn not found!");
    if (!userInfoDiv) console.error("#user-info not found!");
    if (!loginModalOverlay) console.error("#login-modal-overlay not found!");
    if (!loginForm) console.error("#login-form not found!");
    if (!proceedBtn) console.error("#proceed-btn not found!");
    if (!confirmationModalOverlay) console.error("#confirmation-modal-overlay not found!");
    // Add checks for other crucial elements if needed


    // --- Functions ---

    /**
     * Updates the header and potentially other UI based on login status.
     * @param {boolean} isLoggedIn - Whether the user is logged in.
     * @param {string|null} userName - The user's name if logged in.
     */
    function updateUI(isLoggedIn, userName = null) {
        console.log(`Updating UI: Logged In = ${isLoggedIn}, User Name = ${userName}`);

        // Ensure elements exist before trying to modify style
        if (isLoggedIn && userName) {
            if (loginHeaderBtn) loginHeaderBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'inline-flex'; // Use inline-flex from CSS
            if (userInfoDiv) userInfoDiv.style.display = 'flex'; // Use flex from CSS
            if (userNameSpan) userNameSpan.textContent = userName;
            if (proceedStatusMsg) proceedStatusMsg.style.display = 'none'; // Hide proceed message if logged in
        } else {
            if (loginHeaderBtn) loginHeaderBtn.style.display = 'inline-flex';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (userInfoDiv) userInfoDiv.style.display = 'none';
            if (userNameSpan) userNameSpan.textContent = '';
        }
        // Close login modal if user becomes logged in while it's open
         if (isLoggedIn && loginModalOverlay && loginModalOverlay.classList.contains('visible')) {
             hideLoginModal();
         }
    }

    /**
     * Checks the current session status with the backend API.
     * This is the primary way the frontend knows the *actual* server-side login state.
     */
    async function checkSession() {
        console.log("Checking session via /api/verify-session...");
        try {
            const response = await fetch('/api/verify-session'); // GET request is default
            console.log("Verify session response status:", response.status);

            if (!response.ok) {
                // Server error during verification (5xx) or other non-success
                 console.error('Session check failed with status:', response.status);
                 updateUI(false); // Assume logged out
                 return false; // Indicate failure
            }

            const data = await response.json();
            console.log("Verify session response data:", data);
            updateUI(data.loggedIn, data.name); // Update UI based on server response
            return data.loggedIn; // Return the actual login status

        } catch (error) {
            console.error('Network error during session check:', error);
            updateUI(false); // Assume logged out on network error
            return false; // Indicate failure
        }
    }

    // --- Modal Handling ---

    function showLoginModal() {
        if (!loginModalOverlay) return; // Exit if modal doesn't exist
        console.log("Attempting to show login modal.");
        // Reset form fields and error message
        if(loginForm) loginForm.reset();
        if(loginErrorMessage) {
            loginErrorMessage.textContent = '';
            loginErrorMessage.style.display = 'none';
        }
        loginModalOverlay.classList.add('visible'); // Add .visible class (CSS handles display)
        loginModalOverlay.setAttribute('aria-hidden', 'false');
        if (nameInput) nameInput.focus(); // Focus the name field first
    }

    function hideLoginModal() {
        if (!loginModalOverlay) return;
        console.log("Hiding login modal.");
        loginModalOverlay.classList.remove('visible');
        loginModalOverlay.setAttribute('aria-hidden', 'true');
        resetLoginAttemptState(); // Reset button, errors etc.
        pendingLoginDetails = null; // Clear pending details
    }

    function showConfirmationModal() {
         if (!confirmationModalOverlay) return;
         console.log("Showing confirmation modal.");
        confirmationModalOverlay.classList.add('visible');
        confirmationModalOverlay.setAttribute('aria-hidden', 'false');
         // Reset/enable buttons
         if (confirmProceedBtn) {
            confirmProceedBtn.disabled = false;
            confirmProceedBtn.innerHTML = '<span class="icon">✔️</span> Proceed';
            confirmProceedBtn.focus();
         }
         if (confirmCancelBtn) confirmCancelBtn.disabled = false;
    }

    function hideConfirmationModal() {
         if (!confirmationModalOverlay) return;
         console.log("Hiding confirmation modal.");
        confirmationModalOverlay.classList.remove('visible');
        confirmationModalOverlay.setAttribute('aria-hidden', 'true');
    }

    // --- Login/Logout State Management ---

     /**
     * Resets the login button and pending state, optionally sets error message.
     */
     function resetLoginAttemptState(errorMessage = '') {
         isLoginPending = false; // Always allow new attempts after reset
         if (loginSubmitBtn) { // Check if button exists
             loginSubmitBtn.disabled = false;
             loginSubmitBtn.innerHTML = '<span class="icon">🚀</span> Login'; // Restore original content
         }
         if (loginErrorMessage) { // Check if error element exists
             loginErrorMessage.textContent = errorMessage;
             loginErrorMessage.style.display = errorMessage ? 'block' : 'none'; // Show/hide based on message
         }
         // No need to clear pendingLoginDetails here, done in hideLoginModal or on success/fail
     }

     /**
      * Sets a status message (e.g., for the proceed button).
      * @param {HTMLElement} element - The DOM element for the message.
      * @param {string} message - The text to display.
      * @param {'error' | 'loading' | 'success' | null} type - Type for styling.
      */
     function setStatusMessage(element, message, type = null) {
        if (!element) return;
        element.textContent = message;
        element.className = 'status-message'; // Reset classes
        if (type === 'error') element.classList.add('error'); // Assumes 'error' class exists in CSS
        else if (type === 'loading') element.classList.add('loading');
        else if (type === 'success') element.classList.add('success');
        element.style.display = message ? 'block' : 'none';
     }

    // --- API Interaction Logic ---

    /**
     * Performs the actual login API call.
     * @param {string} name
     * @param {string} email
     * @param {string} password
     *@param {boolean} forceLogin - Flag to indicate if overriding an existing session.
     * @returns {Promise<Response>} The fetch response promise.
     */
    async function performLoginRequest(name, email, password, forceLogin = false) {
        const body = { name, email, password };
        if (forceLogin) {
            body.forceLogin = true;
        }
        console.log(`Sending login request to /api/login. Force = ${forceLogin}`);
        // Logging only non-sensitive parts
        console.log(`  with Name: ${name}, Email: ${email}`);

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            console.log(`Login response status: ${response.status}`);
            return response; // Return the whole response object
        } catch (error) {
            console.error('Fetch error during login:', error);
            throw error; // Re-throw to be handled by the caller
        }
    }


    /**
     * Handles the login form submission.
     */
    async function handleLoginSubmit(event) {
        event.preventDefault(); // Prevent default form submission
        console.log("Login form submitted.");

        if (isLoginPending) {
            console.warn('Login attempt already in progress.');
            return;
        }
        // Re-verify elements needed for this specific function
        if (!nameInput || !emailInput || !passwordInput || !loginSubmitBtn || !loginErrorMessage) {
            console.error("One or more login form elements are missing. Cannot proceed.");
            return;
        }

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim(); // No trimming usually needed for passwords

        if (!name || !email || !password) {
            resetLoginAttemptState('Please fill in all fields (Name, Email, Password).');
            return;
        }

        isLoginPending = true;
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.innerHTML = '<span class="icon">⏳</span> Verifying...';
        setStatusMessage(loginErrorMessage, 'Attempting login...', 'loading'); // Use status message helper

        pendingLoginDetails = { name, email, password }; // Store details for potential force login

        try {
            const response = await performLoginRequest(name, email, password, false);
            const responseBody = await response.json().catch(() => null); // Try to parse JSON, ignore if fails

            if (response.ok) {
                console.log('Login successful (Status 200 OK)');
                hideLoginModal(); // Hide modal first
                await checkSession(); // Verify session and update UI fully
                // Reset state is handled by hideLoginModal
            } else if (response.status === 401) {
                console.log('Login unauthorized (401)');
                resetLoginAttemptState('Invalid Email or Password.');
                pendingLoginDetails = null; // Clear pending details on failure
            } else if (response.status === 409) {
                console.log('Login conflict detected (409)');
                setStatusMessage(loginErrorMessage, 'Session conflict detected. Choose below.', 'error');
                showConfirmationModal();
                // Keep isLoginPending=true, pendingLoginDetails is kept
            } else {
                // Handle other errors (400, 500 etc.)
                 const errorMsg = responseBody?.error || `Login failed (Status: ${response.status}).`;
                 console.error('Login failed with unexpected status:', response.status, responseBody);
                 resetLoginAttemptState(errorMsg);
                 pendingLoginDetails = null; // Clear pending details on failure
            }
        } catch (error) {
            console.error('Network or other error during login request:', error);
            resetLoginAttemptState('A network error occurred. Please check your connection.');
            pendingLoginDetails = null; // Clear pending details on failure
        } finally {
             // If login is no longer pending (e.g., success or non-409 error), ensure state is reset
             if (!isLoginPending) { // isLoginPending is set false by resetLoginAttemptState
                 // Button state might already be reset, but ensure
                 if (loginSubmitBtn && loginSubmitBtn.disabled && !confirmationModalOverlay?.classList.contains('visible')) {
                     resetLoginAttemptState(); // Ensure reset if not waiting for confirmation
                 }
             }
        }
    }

    /**
     * Handles the forced login attempt after confirmation.
     */
    async function handleForcedLogin() {
        console.log('Handling forced login.');
        if (!pendingLoginDetails) {
            console.warn('Attempted forced login without pending details.');
            hideConfirmationModal();
            resetLoginAttemptState('Login process interrupted. Please try again.'); // Show in login modal
            return;
        }
        if (!confirmProceedBtn || !confirmCancelBtn) {
             console.error("Confirmation modal buttons missing!");
             return; // Avoid errors
        }

        confirmProceedBtn.disabled = true;
        confirmProceedBtn.innerHTML = '<span class="icon">⏳</span> Processing...';
        confirmCancelBtn.disabled = true; // Disable cancel during processing

        const { name, email, password } = pendingLoginDetails;

        try {
            const forceResponse = await performLoginRequest(name, email, password, true); // Force = true
            const responseBody = await forceResponse.json().catch(() => null);

            if (forceResponse.ok) {
                console.log('Forced login successful');
                hideConfirmationModal(); // Hide confirmation modal
                hideLoginModal(); // Hide login modal too
                await checkSession(); // Update UI
            } else {
                 const errorMsg = responseBody?.error || `Login override failed (Status: ${forceResponse.status}).`;
                 console.error('Forced login failed:', forceResponse.status, responseBody);
                 hideConfirmationModal(); // Still hide confirmation modal
                 resetLoginAttemptState(errorMsg); // Show error in login modal
                 // Buttons will be re-enabled by resetLoginAttemptState if modal is visible
            }
        } catch (forceError) {
            console.error('Error during forced login fetch:', forceError);
            hideConfirmationModal();
            resetLoginAttemptState('A network error occurred during override.');
        } finally {
            // Whether success or fail, clear pending state and details for force login
            isLoginPending = false;
            pendingLoginDetails = null;
             // Ensure buttons are re-enabled if confirmation modal somehow remains visible
             if (confirmProceedBtn) confirmProceedBtn.disabled = false; confirmProceedBtn.innerHTML = '<span class="icon">✔️</span> Proceed';
             if (confirmCancelBtn) confirmCancelBtn.disabled = false;
        }
    }


    /**
     * Handles the logout process by calling the backend API.
     */
    async function handleLogout() {
        console.log("Logout button clicked.");
        if (!logoutBtn) return; // Should not happen if button is visible

        logoutBtn.disabled = true;
        logoutBtn.innerHTML = '<span class="icon">⏳</span> Logging out...';

        try {
            const response = await fetch('/api/logout', { method: 'POST' });
            console.log('Logout response status:', response.status);
             if (!response.ok) {
                 console.error("Logout API request failed:", response.status);
                 // Decide if user should see an error or just proceed with UI update
             }
        } catch (error) {
            console.error('Network error during logout fetch:', error);
            // Show error to user?
        } finally {
            // ALWAYS update UI to logged-out state after attempt
             updateUI(false);
             // Button gets hidden by updateUI, no need to manually re-enable/reset text
        }
    }

    /**
     * Handles the "Proceed" button click.
     * Checks session with the server *before* navigating.
     */
     async function handleProceed() {
         console.log("Proceed button clicked.");
         if (!proceedBtn || !proceedStatusMsg) return;

         proceedBtn.disabled = true;
         proceedBtn.innerHTML = '<span class="icon">⏳</span> Checking Access...';
         setStatusMessage(proceedStatusMsg, 'Verifying your session...', 'loading');

         try {
             // Explicitly verify session with the server *now*
             const isLoggedIn = await checkSession(); // checkSession now returns true/false

             if (isLoggedIn) {
                 console.log("Proceed verification successful. Navigating to b.html");
                 setStatusMessage(proceedStatusMsg, 'Access granted. Redirecting...', 'success');
                 // Short delay for user to see the success message
                 setTimeout(() => {
                    window.location.href = 'b.html';
                 }, 300); // 300ms delay
                 // No need to re-enable button as we are navigating away
             } else {
                 console.log("Proceed verification failed: Not logged in.");
                 setStatusMessage(proceedStatusMsg, 'Access denied. Please log in first.', 'error');
                 proceedBtn.disabled = false; // Re-enable button
                 proceedBtn.innerHTML = '<span class="icon">🚀</span> Proceed to App';
             }
         } catch (error) {
             // This catch might be redundant if checkSession handles its own errors,
             // but good for catching unexpected issues.
             console.error("Error during proceed verification:", error);
             setStatusMessage(proceedStatusMsg, 'Error checking session. Please try again.', 'error');
             proceedBtn.disabled = false;
             proceedBtn.innerHTML = '<span class="icon">🚀</span> Proceed to App';
         }
     }


    // --- Event Listeners ---
    // Attach listeners only if elements exist
    if (loginHeaderBtn) loginHeaderBtn.addEventListener('click', showLoginModal);
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', hideLoginModal);
    if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (proceedBtn) proceedBtn.addEventListener('click', handleProceed);
    if (confirmProceedBtn) confirmProceedBtn.addEventListener('click', handleForcedLogin);
    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', () => {
            console.log('Confirmation Cancel button clicked');
            hideConfirmationModal();
            resetLoginAttemptState('Login cancelled.'); // Show message in login modal
            isLoginPending = false; // Ensure pending state is cleared
            pendingLoginDetails = null;
        });
    }

    // Modal Overlay Clicks
    if (loginModalOverlay) {
        loginModalOverlay.addEventListener('click', (event) => {
            if (event.target === loginModalOverlay) { // Only if clicking overlay itself
                console.log("Login modal overlay clicked.");
                hideLoginModal();
            }
        });
    }
    if (confirmationModalOverlay) {
         confirmationModalOverlay.addEventListener('click', (event) => {
            if (event.target === confirmationModalOverlay) {
                 console.log("Confirmation modal overlay clicked.");
                 hideConfirmationModal();
                 resetLoginAttemptState('Login cancelled.'); // Show message in login modal
                 isLoginPending = false; // Ensure pending state is cleared
                 pendingLoginDetails = null;
            }
         });
     }

    // Escape Key Listener
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
             console.log("Escape key pressed.");
             if (confirmationModalOverlay && confirmationModalOverlay.classList.contains('visible')) {
                 console.log("Hiding confirmation modal via Escape.");
                 hideConfirmationModal();
                 resetLoginAttemptState('Login cancelled.');
                 isLoginPending = false;
                 pendingLoginDetails = null;
             } else if (loginModalOverlay && loginModalOverlay.classList.contains('visible')) {
                 console.log("Hiding login modal via Escape.");
                 hideLoginModal();
             }
        }
    });

    // --- Initial Session Check on Page Load ---
    console.log("Running initial session check...");
    checkSession(); // Check login status when the page loads

}); // --- End DOMContentLoaded ---
