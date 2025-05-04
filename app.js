// app.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("App JS Loaded - Revised Access Token Flow");

    // --- DOM Elements (Login/Session related) ---
    const loginHeaderBtn = document.getElementById('login-header-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfoDiv = document.getElementById('user-info');
    const userNameSpan = document.getElementById('user-name');
    const proceedBtn = document.getElementById('proceed-btn');
    const proceedStatusMsg = document.getElementById('proceed-status-message');
    const loginModalOverlay = document.getElementById('login-modal-overlay');
    const loginForm = document.getElementById('login-form');
    const nameInput = document.getElementById('name-input');
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const loginSubmitBtn = document.getElementById('login-submit-btn');
    const loginErrorMessage = document.getElementById('login-error-message');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const confirmationModalOverlay = document.getElementById('confirmation-modal-overlay');
    const confirmProceedBtn = document.getElementById('confirm-proceed-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

    // --- DOM Elements (Demo Section - Assuming unchanged) ---
    // ... (Keep all your demo section element getters here) ...
    const site1W1OddsInput = document.getElementById('site1-w1-odds');
    const site1W2OddsInput = document.getElementById('site1-w2-odds');
    const site2W1OddsInput = document.getElementById('site2-w1-odds');
    const site2W2OddsInput = document.getElementById('site2-w2-odds');
    const site1W1Error = document.getElementById('site1-w1-error');
    const site1W2Error = document.getElementById('site1-w2-error');
    const site2W1Error = document.getElementById('site2-w1-error');
    const site2W2Error = document.getElementById('site2-w2-error');
    const totalAmountInput = document.getElementById('total-amount');
    const totalAmountError = document.getElementById('total-amount-error');
    const calculateDemoBtn = document.getElementById('calculate-demo-btn');
    const demoResultsDiv = document.getElementById('demo-results');
    const resultMessageEl = document.getElementById('result-message');
    const resultDetailsEl = document.getElementById('result-details');
    const resultProfitEl = document.getElementById('result-profit');
    const showFixedBetBtn = document.getElementById('show-fixed-bet-btn');
    const fixedBetSectionDiv = document.getElementById('fixed-bet-section');
    const fixedBetRadioButtons = document.querySelectorAll('input[name="fixed_bet_team"]');
    const fixedTeamError = document.getElementById('fixed-team-error');
    const fixedAmountInput = document.getElementById('fixed-amount');
    const fixedAmountError = document.getElementById('fixed-amount-error');
    const calculateFixedBtn = document.getElementById('calculate-fixed-btn');
    const fixedBetResultsDiv = document.getElementById('fixed-bet-results');
    const tryItButtons = document.querySelectorAll('.try-button');
    const fixedTeamALabel = document.getElementById('fixed-teamA-label');
    const fixedTeamBLabel = document.getElementById('fixed-teamB-label');


    // --- State ---
    let currentUser = null; // Stores { name, email } if logged in
    let isLoginSubmitting = false; // Prevent double submission
    let pendingForceLoginDetails = null; // Stores { name, email, password } for confirmation

    // --- Helper Function: Set Status Message ---
    function setStatusMessage(element, message, type = 'info') { // types: info, success, error, loading
        if (!element) return;
        element.textContent = message;
        // Reset classes, then add the current type
        element.className = 'status-message'; // Base class
        if (type) {
            element.classList.add(type);
        }
        element.style.display = message ? 'block' : 'none';
    }

    // --- Helper Function: UI Update ---
    function updateUI() {
        console.log("Updating UI. Current user:", currentUser);
        if (currentUser && currentUser.name) {
            // Logged In State
            if (loginHeaderBtn) loginHeaderBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'inline-flex';
            if (userInfoDiv) userInfoDiv.style.display = 'flex';
            if (userNameSpan) userNameSpan.textContent = currentUser.name;

            // If user is logged in, ensure login modal is hidden
            if (loginModalOverlay?.classList.contains('visible')) {
                 hideLoginModal();
            }
            // Reset proceed button if needed (e.g., after failed attempt)
             if (proceedBtn) {
                 proceedBtn.disabled = false;
                 proceedBtn.innerHTML = '<span class="icon">💰</span> पैसा कमाउन सुरु गर्नुहोस्';
                 setStatusMessage(proceedStatusMsg, '', 'info'); // Clear proceed message
             }

        } else {
            // Logged Out State
            if (loginHeaderBtn) loginHeaderBtn.style.display = 'inline-flex';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (userInfoDiv) userInfoDiv.style.display = 'none';
            if (userNameSpan) userNameSpan.textContent = '';

             // Reset proceed button
             if (proceedBtn) {
                 proceedBtn.disabled = false;
                 proceedBtn.innerHTML = '<span class="icon">💰</span> पैसा कमाउन सुरु गर्नुहोस्';
                  // Optionally clear proceed message on logout, or leave error if applicable
                 // setStatusMessage(proceedStatusMsg, '', 'info');
             }
        }
        // Always ensure confirmation modal is hidden unless actively shown
        if (confirmationModalOverlay?.classList.contains('visible') && !pendingForceLoginDetails) {
            hideConfirmationModal();
        }
    }

    // --- Helper Functions: Modals ---
    function showLoginModal() {
        if (!loginModalOverlay) return;
        loginErrorMessage.textContent = ''; // Clear previous errors
        loginForm?.reset(); // Reset form fields
        loginModalOverlay.classList.add('visible');
        loginModalOverlay.setAttribute('aria-hidden', 'false');
        emailInput?.focus(); // Focus email input
    }

    function hideLoginModal() {
        if (!loginModalOverlay) return;
        loginModalOverlay.classList.remove('visible');
        loginModalOverlay.setAttribute('aria-hidden', 'true');
        resetLoginAttemptState(); // Clear any pending states
    }

     function showConfirmationModal() {
        if (!confirmationModalOverlay) return;
        confirmationModalOverlay.classList.add('visible');
        confirmationModalOverlay.setAttribute('aria-hidden', 'false');
     }

     function hideConfirmationModal() {
         if (!confirmationModalOverlay) return;
         confirmationModalOverlay.classList.remove('visible');
         confirmationModalOverlay.setAttribute('aria-hidden', 'true');
     }

    function resetLoginAttemptState(errorMessage = '') {
        isLoginSubmitting = false;
        pendingForceLoginDetails = null;
        if (loginSubmitBtn) {
             loginSubmitBtn.disabled = false;
             loginSubmitBtn.innerHTML = '<span class="icon">🚀</span> Login';
        }
        setStatusMessage(loginErrorMessage, errorMessage, 'error');
    }


    // --- Core Auth Functions ---

    async function checkSession() {
        console.log("Checking session via GET /api/verify-session...");
        setStatusMessage(proceedStatusMsg, 'Checking session...', 'loading'); // Indicate activity
        try {
            const response = await fetch('/api/verify-session', {
                 method: 'GET',
                 headers: {
                    // No 'Content-Type' needed for GET with no body
                    'Accept': 'application/json'
                 }
            });

            const data = await response.json();

            if (response.ok && data.loggedIn) {
                console.log("Session valid:", data);
                currentUser = { name: data.name, email: data.email };
            } else {
                console.log("Session invalid or expired:", data);
                currentUser = null;
                // The backend might have sent headers to clear the cookie already
            }
        } catch (error) {
            console.error('Network or parsing error during checkSession:', error);
            currentUser = null;
            setStatusMessage(proceedStatusMsg, 'Could not verify session.', 'error');
        } finally {
             updateUI(); // Update UI based on check result
             // Clear the loading message if it was set by this function
             if (proceedStatusMsg && proceedStatusMsg.classList.contains('loading')) {
                setStatusMessage(proceedStatusMsg, '', 'info');
             }
        }
    }

    async function performLoginRequest(name, email, password, forceLogin = false) {
        if (isLoginSubmitting) return; // Prevent double clicks
        isLoginSubmitting = true;
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.innerHTML = '<span class="icon">⏳</span> Logging In...';
        setStatusMessage(loginErrorMessage, '', 'info'); // Clear previous errors

        console.log(`Attempting login: ${email}, Force: ${forceLogin}`);

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ name, email, password, forceLogin })
            });

            const data = await response.json();

            if (response.ok && data.status === 'success') {
                // SUCCESS
                console.log("Login successful:", data);
                currentUser = { name: data.name, email: email }; // Store user data from response
                hideLoginModal(); // Close modal
                updateUI(); // Update header etc.
                // No need to manually set state here, checkSession on next load will confirm

            } else if (response.status === 409 && data.conflict) {
                // CONFLICT - Ask user to force
                console.log("Login conflict detected.");
                setStatusMessage(loginErrorMessage, data.message || 'Already logged in elsewhere.', 'error');
                pendingForceLoginDetails = { name, email, password }; // Store details for confirmation
                showConfirmationModal();
                // Keep login button disabled until user confirms/cancels

            } else {
                // OTHER ERRORS (400, 401, 500, etc.)
                console.error("Login failed:", response.status, data);
                const errorMessage = data.error || 'Login failed. Please check details or try again later.';
                resetLoginAttemptState(errorMessage);
            }

        } catch (error) {
            console.error('Network error during login:', error);
            resetLoginAttemptState('Login failed due to network error. Please check connection.');
        } finally {
            // Only re-enable if not waiting for confirmation
            if (!pendingForceLoginDetails) {
                isLoginSubmitting = false;
                // Ensure button state is correct if login didn't succeed or lead to conflict modal
                if (!currentUser && loginSubmitBtn && loginSubmitBtn.disabled) {
                    loginSubmitBtn.disabled = false;
                    loginSubmitBtn.innerHTML = '<span class="icon">🚀</span> Login';
                }
            }
        }
    }

    function handleLoginSubmit(event) {
        event.preventDefault(); // Prevent default form submission
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value; // Don't trim password

        if (!name || !email || !password) {
            setStatusMessage(loginErrorMessage, 'Please enter name, email, and password.', 'error');
            return;
        }
        performLoginRequest(name, email, password, false); // Initial login attempt (not forced)
    }

    function handleForcedLogin() {
        if (pendingForceLoginDetails) {
            hideConfirmationModal();
            const { name, email, password } = pendingForceLoginDetails;
            pendingForceLoginDetails = null; // Clear pending state
            console.log("User confirmed force login.");
            // Re-attempt login with forceLogin = true
            performLoginRequest(name, email, password, true);
        } else {
             console.warn("handleForcedLogin called without pending details.");
             hideConfirmationModal(); // Hide modal just in case
             resetLoginAttemptState('An error occurred. Please try logging in again.'); // Reset main form
        }
    }

    async function performLogoutRequest() {
         console.log("Attempting logout via POST /api/logout...");
         try {
             // ** ASSUMPTION: You will create a /api/logout endpoint **
             // This endpoint should invalidate session in KV and clear the cookie
             const response = await fetch('/api/logout', {
                 method: 'POST',
                 headers: { 'Accept': 'application/json' }
             });

             if (!response.ok) {
                 // Log error but proceed with client-side logout anyway
                 const errorData = await response.json().catch(() => ({}));
                 console.error("Logout request failed:", response.status, errorData);
             } else {
                 console.log("Logout request successful.");
             }

         } catch (error) {
             console.error("Network error during logout:", error);
             // Proceed with client-side logout even if network fails
         } finally {
             // Always update client state regardless of backend success/failure
             currentUser = null;
             updateUI();
             console.log("Client state updated to logged out.");
              // Optionally redirect to home page or show a message
             // window.location.href = '/'; // Example redirect
         }
    }

    function handleLogout() {
        performLogoutRequest();
    }


    // --- Proceed Button Logic ---
    async function handleProceed() {
        if (!proceedBtn || !proceedStatusMsg) return;

        proceedBtn.disabled = true;
        proceedBtn.innerHTML = '<span class="icon">⏳</span> Checking Access...';
        setStatusMessage(proceedStatusMsg, 'Verifying your session...', 'loading');

        let canProceed = false;

        // Step 1: Re-verify session first
        try {
            const verifyResponse = await fetch('/api/verify-session');
            const verifyData = await verifyResponse.json();

            if (verifyResponse.ok && verifyData.loggedIn) {
                console.log("Proceed: Session confirmed valid.");
                setStatusMessage(proceedStatusMsg, 'Session valid. Requesting access...', 'loading');

                // Step 2: Request short-lived access token
                try {
                    const tokenResponse = await fetch('/api/generate-access-token', {
                         method: 'POST',
                         headers: { 'Accept': 'application/json' } // No Content-Type needed if no body
                    });
                    const tokenData = await tokenResponse.json();

                    if (tokenResponse.ok && tokenData.status === 'success') {
                         console.log("Proceed: Access token generated successfully.");
                         setStatusMessage(proceedStatusMsg, 'Access granted. Redirecting...', 'success');
                         canProceed = true; // Mark for redirection

                         // Redirect after a short delay to show message
                         setTimeout(() => {
                             window.location.href = 'b.html';
                         }, 500); // Adjust delay as needed

                    } else {
                         // Failed to get access token (session might have expired just now, or server error)
                         console.error("Proceed: Failed to get access token.", tokenResponse.status, tokenData);
                         const errorMsg = tokenData.error || 'Could not get access for protected area.';
                         setStatusMessage(proceedStatusMsg, `Access Denied: ${errorMsg}`, 'error');
                         // Re-sync UI if session was likely the cause
                         if (tokenResponse.status === 401) {
                             await checkSession(); // Update UI to reflect likely logged-out state
                         }
                    }
                } catch (tokenError) {
                     console.error("Proceed: Network error requesting access token:", tokenError);
                     setStatusMessage(proceedStatusMsg, 'Network error requesting access. Please try again.', 'error');
                }

            } else {
                // Session verification failed
                console.log("Proceed: Session verification failed. User not logged in.");
                setStatusMessage(proceedStatusMsg, 'Access Denied: You must be logged in to proceed.', 'error');
                currentUser = null; // Ensure local state is cleared
                updateUI(); // Update UI to show login button etc.
                // Optionally trigger login modal directly
                // showLoginModal();
            }

        } catch (verifyError) {
             console.error("Proceed: Network error verifying session:", verifyError);
             setStatusMessage(proceedStatusMsg, 'Network error checking session. Please try again.', 'error');
        } finally {
             // Re-enable button ONLY if we are NOT redirecting
             if (!canProceed && proceedBtn) {
                  proceedBtn.disabled = false;
                  proceedBtn.innerHTML = '<span class="icon">💰</span> पैसा कमाउन सुरु गर्नुहोस्';
             }
        }
    }


    // --- Demo Section Functions (Assuming Unchanged - Keep your existing code) ---
    function validateDemoOdds() { console.log("Demo: Validating odds..."); /* ... */ return null; }
    function calculateArbitrage(s1w1, s1w2, s2w1, s2w2, totalAmount) { console.log("Demo: Calculating arbitrage..."); /* ... */ return { isArbitrage: false }; }
    function updateFixedBetLabels(demoCalc) { console.log("Demo: Updating fixed bet labels..."); /* ... */ }
    function displayDemoResults(result) { console.log("Demo: Displaying results..."); /* ... */ }
    function handleCalculateDemo() { console.log("Demo: Calculate button clicked."); /* ... call validation, calculation, display ... */ }
    function handleShowFixedBet() { console.log("Demo: Show fixed bet clicked."); /* ... */ }
    function validateFixedBet() { console.log("Demo: Validating fixed bet..."); /* ... */ return null; }
    function calculateFixedBet(fixedTeamValue, fixedAmount, demoCalc) { console.log("Demo: Calculating fixed bet..."); /* ... */ return null; }
    function displayFixedBetResults(result) { console.log("Demo: Displaying fixed bet results..."); /* ... */ }
    function handleCalculateFixed() { console.log("Demo: Calculate fixed button clicked."); /* ... */ }
    function handleTryItClick(event) { console.log("Demo: Try it button clicked."); /* ... */ }
     // Helper to clear demo errors/results on input
     function clearDemoState() {
        [site1W1Error, site1W2Error, site2W1Error, site2W2Error, totalAmountError, fixedTeamError, fixedAmountError].forEach(el => { if(el) el.textContent = ''; });
        [demoResultsDiv, fixedBetSectionDiv, fixedBetResultsDiv].forEach(el => { if(el) el.style.display = 'none'; });
        if(resultMessageEl) resultMessageEl.textContent = '';
        if(resultDetailsEl) resultDetailsEl.innerHTML = '';
        if(resultProfitEl) resultProfitEl.textContent = '';
    }


    // --- Event Listeners Setup ---
    console.log("Setting up event listeners...");

    // Auth Listeners
    if (loginHeaderBtn) {
        loginHeaderBtn.addEventListener('click', showLoginModal);
        console.log("Attached listener to loginHeaderBtn");
    } else { console.error("Element #login-header-btn not found"); }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', hideLoginModal);
        console.log("Attached listener to modalCloseBtn");
    } else { console.error("Element #modal-close-btn not found"); }

    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
        console.log("Attached listener to loginForm");
    } else { console.error("Element #login-form not found"); }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
        console.log("Attached listener to logoutBtn");
    } else { console.error("Element #logout-btn not found"); }

    if (proceedBtn) {
        proceedBtn.addEventListener('click', handleProceed);
        console.log("Attached listener to proceedBtn");
    } else { console.error("Element #proceed-btn not found"); }

    if (confirmProceedBtn) {
        confirmProceedBtn.addEventListener('click', handleForcedLogin);
         console.log("Attached listener to confirmProceedBtn");
    } else { console.error("Element #confirm-proceed-btn not found"); }

    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', () => {
             hideConfirmationModal();
             resetLoginAttemptState('Login cancelled.'); // Reset state of main login form
             pendingForceLoginDetails = null; // Ensure pending details are cleared
        });
         console.log("Attached listener to confirmCancelBtn");
    } else { console.error("Element #confirm-cancel-btn not found"); }

    // Modal overlay clicks to close
    if (loginModalOverlay) loginModalOverlay.addEventListener('click', (e) => { if (e.target === loginModalOverlay) hideLoginModal(); });
    if (confirmationModalOverlay) confirmationModalOverlay.addEventListener('click', (e) => { if (e.target === confirmationModalOverlay) { hideConfirmationModal(); resetLoginAttemptState('Login cancelled.'); pendingForceLoginDetails = null;} });

    // Demo Section Listeners (Assuming Unchanged)
     if (calculateDemoBtn) {
         calculateDemoBtn.addEventListener('click', handleCalculateDemo);
          console.log("Attached listener to calculateDemoBtn");
     } else { console.error("Element #calculate-demo-btn not found"); }

     if (showFixedBetBtn) {
         showFixedBetBtn.addEventListener('click', handleShowFixedBet);
          console.log("Attached listener to showFixedBetBtn");
     } else { console.error("Element #show-fixed-bet-btn not found"); }

     if (calculateFixedBtn) {
         calculateFixedBtn.addEventListener('click', handleCalculateFixed);
          console.log("Attached listener to calculateFixedBtn");
     } else { console.error("Element #calculate-fixed-btn not found"); }

     tryItButtons.forEach((button, index) => {
         button.addEventListener('click', handleTryItClick);
          console.log(`Attached listener to tryItButton ${index}`);
     });
     // Demo Input listeners
     [site1W1OddsInput, site1W2OddsInput, site2W1OddsInput, site2W2OddsInput, totalAmountInput, fixedAmountInput].forEach(input => {
          if (input) {
             input.addEventListener('input', clearDemoState);
          }
      });
      fixedBetRadioButtons.forEach(radio => {
         if(radio) {
             radio.addEventListener('change', clearDemoState);
         }
      });


    // --- Initial Check ---
    console.log("Running initial session check on page load...");
    checkSession(); // Check login status when the page loads

}); // --- End DOMContentLoaded ---
