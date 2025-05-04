// /app.js (or /public/app.js)

document.addEventListener('DOMContentLoaded', () => {
    console.log("App JS Loaded - v5 (Access Token Flow)"); // Version marker

    // --- DOM Elements (Login/Session related) ---
    const loginHeaderBtn = document.getElementById('login-header-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userInfoDiv = document.getElementById('user-info');
    const userNameSpan = document.getElementById('user-name');
    const proceedBtn = document.getElementById('proceed-btn'); // Button that triggers access to b.html
    const proceedStatusMsg = document.getElementById('proceed-status-message'); // Status message near proceedBtn
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
    let isLoginPending = false;
    let pendingLoginDetails = null;
    let lastDemoCalculation = null;

    // --- Constants (Demo Expected Values - Unchanged) ---
    const EXPECTED_ODDS = {
        site1_w1: 1.749, site1_w2: 2.112, site2_w1: 1.86, site2_w2: 2.08
    };


    // --- Helper Function: Show/Hide Input Error (Unchanged) ---
    function showInputError(errorElement, message) { /* ... */ }
    function clearInputError(errorElement) { /* ... */ }

    // --- Login/Session Functions (Most are unchanged, checkSession and updateUI are key) ---
    function updateUI(isLoggedIn, userName = null) {
        console.log(`Updating UI: Logged In = ${isLoggedIn}, User Name = ${userName}`);
        if (isLoggedIn && userName) {
            if (loginHeaderBtn) loginHeaderBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'inline-flex';
            if (userInfoDiv) userInfoDiv.style.display = 'flex';
            if (userNameSpan) userNameSpan.textContent = userName;
            // Hide proceed status message when UI updates (e.g., after successful login/logout)
            if (proceedStatusMsg) proceedStatusMsg.style.display = 'none';
        } else {
            if (loginHeaderBtn) loginHeaderBtn.style.display = 'inline-flex';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (userInfoDiv) userInfoDiv.style.display = 'none';
            if (userNameSpan) userNameSpan.textContent = '';
            // Also hide proceed status message on logout
             if (proceedStatusMsg) proceedStatusMsg.style.display = 'none';
        }
         // Ensure login modal is hidden if user becomes logged in
         if (isLoggedIn && loginModalOverlay?.classList.contains('visible')) { hideLoginModal(); }
         // Ensure proceed button is re-enabled if user logs out
         if (!isLoggedIn && proceedBtn) {
            proceedBtn.disabled = false;
            proceedBtn.innerHTML = '<span class="icon">💰</span> पैसा कमाउन सुरु गर्नुहोस्';
         }
    }

    async function checkSession() {
        console.log("Checking session via /api/verify-session...");
        try {
            // Fetch directly here, updateUI will be called based on the result
            const response = await fetch('/api/verify-session');
            if (!response.ok) {
                console.error('Session check failed:', response.status);
                updateUI(false); // Update UI to logged out state
                return { loggedIn: false }; // Return status
            }
            const data = await response.json();
            updateUI(data.loggedIn, data.name); // Update UI based on response
            return data; // Return the full data { loggedIn, name?, email? }
        } catch (error) {
            console.error('Network error during checkSession:', error);
            updateUI(false); // Update UI to logged out state on network error
            return { loggedIn: false }; // Return status
        }
     }

    function showLoginModal() { /* ... (unchanged) ... */ }
    function hideLoginModal() { /* ... (unchanged) ... */ }
    function showConfirmationModal() { /* ... (unchanged) ... */ }
    function hideConfirmationModal() { /* ... (unchanged) ... */ }
    function resetLoginAttemptState(errorMessage = '') { /* ... (unchanged) ... */ }

    function setStatusMessage(element, message, type = null) {
        if (!element) return;
        element.textContent = message;
        element.className = 'status-message'; // Reset classes
        if (type === 'error') element.classList.add('error');
        else if (type === 'loading') element.classList.add('loading');
        else if (type === 'success') element.classList.add('success');
        element.style.display = message ? 'block' : 'none'; // Show/hide based on message presence
    }

    async function performLoginRequest(name, email, password, forceLogin = false) { /* ... (unchanged) ... */ }
    async function handleLoginSubmit(event) { /* ... (unchanged) ... */ }
    async function handleForcedLogin() { /* ... (unchanged) ... */ }
    async function handleLogout() { /* ... (unchanged) ... */ }

    // --- *** MODIFIED: handleProceed Function *** ---
    async function handleProceed() {
        if (!proceedBtn || !proceedStatusMsg) {
            console.error("Proceed button or status message element not found.");
            return;
        }

        proceedBtn.disabled = true;
        proceedBtn.innerHTML = '<span class="icon">⏳</span> Checking Access...';
        setStatusMessage(proceedStatusMsg, 'Verifying your session...', 'loading');

        let loggedIn = false;
        let shouldReEnableButton = true; // Assume button should be re-enabled unless redirection occurs

        try {
            // Step 1: Check if the user has a valid long-lived session
            console.log("Proceed: Checking session via /api/verify-session...");
            const sessionResponse = await fetch('/api/verify-session'); // Use fetch directly
            const sessionData = await sessionResponse.json();

            if (sessionResponse.ok && sessionData.loggedIn) {
                loggedIn = true; // User has a valid session
                console.log("Proceed: Session valid. User:", sessionData.name || sessionData.email);
                setStatusMessage(proceedStatusMsg, 'Session valid. Requesting short-term access...', 'loading');

                // Step 2: Session is valid, now request a short-lived access token
                console.log("Proceed: Requesting access token via POST /api/generate-access-token...");
                const accessTokenResponse = await fetch('/api/generate-access-token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json' // Good practice, even if no body is sent
                    }
                 });

                if (accessTokenResponse.ok) {
                    // Step 3: Access token granted, now redirect
                    setStatusMessage(proceedStatusMsg, 'Access granted. Redirecting...', 'success');
                    console.log("Proceed: Access token received successfully. Redirecting to b.html");
                    shouldReEnableButton = false; // Do not re-enable button, we are navigating away

                    // Use a small delay AFTER setting the message so user can see it
                    setTimeout(() => {
                         window.location.href = 'b.html';
                    }, 300);
                    return; // Exit function early on successful redirection

                } else {
                    // Failed to get access token (e.g., session expired between checks, server error)
                    const errorData = await accessTokenResponse.json().catch(() => ({ error: 'Unknown error getting access token' }));
                    console.error("Proceed: Failed to get access token.", accessTokenResponse.status, errorData);
                    setStatusMessage(proceedStatusMsg, `Access token denied: ${errorData.error || 'Please log in again or try again.'}`, 'error');
                    // Optionally trigger login modal if status is 401?
                    if (accessTokenResponse.status === 401) {
                        // Maybe the session got invalidated just now
                        await checkSession(); // Re-check session to update UI
                        // showLoginModal(); // Uncomment to force login modal
                    }
                }

            } else {
                // User is not logged in based on initial session check
                console.log("Proceed: Access denied. User not logged in or session invalid.");
                setStatusMessage(proceedStatusMsg, 'Access denied. Please log in first.', 'error');
                // Optionally show login modal automatically
                // showLoginModal();
            }

        } catch (error) {
            // Catch errors from either fetch call or JSON parsing
            console.error("Proceed: Error during access check or token request:", error);
            setStatusMessage(proceedStatusMsg, 'Error checking access. Check connection or try again.', 'error');
        } finally {
            // Re-enable the button ONLY if we didn't successfully start the redirection process
            if (shouldReEnableButton && proceedBtn) {
                 proceedBtn.disabled = false;
                 // Restore original button text (ensure this matches your HTML)
                 proceedBtn.innerHTML = '<span class="icon">💰</span> पैसा कमाउन सुरु गर्नुहोस्';
            }
             // Update UI based on final loggedIn state if redirection didn't happen
             if (shouldReEnableButton) {
                 await checkSession(); // Ensure UI reflects the latest session status
             }
        }
    }


    // --- Demo Section Functions (Assuming unchanged from previous version) ---
    function validateDemoOdds() { /* ... */ return null; }
    function calculateArbitrage(s1w1, s1w2, s2w1, s2w2, totalAmount) { /* ... */ return { isArbitrage: false }; }
    function updateFixedBetLabels(demoCalc) { /* ... */ }
    function displayDemoResults(result) { /* ... */ }
    function handleCalculateDemo() { /* ... */ }
    function handleShowFixedBet() { /* ... */ }
    function validateFixedBet() { /* ... */ return null; }
    function calculateFixedBet(fixedTeamValue, fixedAmount, demoCalc) { /* ... */ return null; }
    function displayFixedBetResults(result) { /* ... */ }
    function handleCalculateFixed() { /* ... */ }
    function handleTryItClick(event) { /* ... */ }


    // --- Event Listeners Setup ---
    // Login/Session Listeners
    if (loginHeaderBtn) loginHeaderBtn.addEventListener('click', showLoginModal);
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', hideLoginModal);
    if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (proceedBtn) proceedBtn.addEventListener('click', handleProceed); // *** Connects the button ***
    if (confirmProceedBtn) confirmProceedBtn.addEventListener('click', handleForcedLogin);
    if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', () => { hideConfirmationModal(); resetLoginAttemptState('Login cancelled.'); isLoginPending = false; pendingLoginDetails = null; });
    if (loginModalOverlay) loginModalOverlay.addEventListener('click', (e) => { if (e.target === loginModalOverlay) hideLoginModal(); });
    if (confirmationModalOverlay) confirmationModalOverlay.addEventListener('click', (e) => { if (e.target === confirmationModalOverlay) { hideConfirmationModal(); resetLoginAttemptState('Login cancelled.'); isLoginPending = false; pendingLoginDetails = null;} });
    // Removed escape key listener for brevity, add back if needed

    // Demo Section Listeners (Assuming unchanged)
    if (calculateDemoBtn) calculateDemoBtn.addEventListener('click', handleCalculateDemo);
    if (showFixedBetBtn) showFixedBetBtn.addEventListener('click', handleShowFixedBet);
    if (calculateFixedBtn) calculateFixedBtn.addEventListener('click', handleCalculateFixed);
    tryItButtons.forEach(button => button.addEventListener('click', handleTryItClick));
    // Input listeners for demo section (Assuming unchanged)
    [site1W1OddsInput, site1W2OddsInput, site2W1OddsInput, site2W2OddsInput, totalAmountInput, fixedAmountInput].forEach(input => {
         if (input) { input.addEventListener('input', () => { /* ... clear errors/results ... */ }); }
     });
     fixedBetRadioButtons.forEach(radio => {
        radio.addEventListener('change', () => { /* ... clear errors/results ... */ });
     });


    // --- Initial Session Check ---
    console.log("Running initial session check on page load...");
    checkSession(); // Run initial check to set UI state

}); // --- End DOMContentLoaded --- 
