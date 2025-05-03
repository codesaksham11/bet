// /app.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("App JS Loaded - v4 (Demo Logic Corrected)"); // Version marker

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

    // --- DOM Elements (Demo Section) ---
    const site1W1OddsInput = document.getElementById('site1-w1-odds');
    const site1W2OddsInput = document.getElementById('site1-w2-odds');
    const site2W1OddsInput = document.getElementById('site2-w1-odds'); // Lucknow on BC.Game
    const site2W2OddsInput = document.getElementById('site2-w2-odds'); // Kings on BC.Game
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
    // Labels for fixed bet radio buttons
    const fixedTeamALabel = document.getElementById('fixed-teamA-label');
    const fixedTeamBLabel = document.getElementById('fixed-teamB-label');


    // --- State ---
    let isLoginPending = false;
    let pendingLoginDetails = null;
    let lastDemoCalculation = null; // Stores result of last successful arbitrage calc

    // --- Constants (Demo Expected Values - CORRECTED) ---
    const EXPECTED_ODDS = {
        site1_w1: 1.749, // 1xBet Kings
        site1_w2: 2.112, // 1xBet Lucknow
        site2_w1: 1.86,  // BC.Game Lucknow (Input ID: site2-w1-odds)
        site2_w2: 2.08   // BC.Game Kings   (Input ID: site2-w2-odds)
    };


    // --- Helper Function: Show/Hide Input Error ---
    function showInputError(errorElement, message) {
        if (!errorElement) return;
        errorElement.textContent = message;
        errorElement.classList.add('visible'); // Add class to show
    }
    function clearInputError(errorElement) {
        if (!errorElement) return;
        errorElement.textContent = '';
        errorElement.classList.remove('visible'); // Remove class to hide
    }

    // --- Login/Session Functions (Unchanged from previous working version) ---
    function updateUI(isLoggedIn, userName = null) {
        console.log(`Updating UI: Logged In = ${isLoggedIn}, User Name = ${userName}`);
        if (isLoggedIn && userName) {
            if (loginHeaderBtn) loginHeaderBtn.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'inline-flex';
            if (userInfoDiv) userInfoDiv.style.display = 'flex';
            if (userNameSpan) userNameSpan.textContent = userName;
            if (proceedStatusMsg) proceedStatusMsg.style.display = 'none';
        } else {
            if (loginHeaderBtn) loginHeaderBtn.style.display = 'inline-flex';
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (userInfoDiv) userInfoDiv.style.display = 'none';
            if (userNameSpan) userNameSpan.textContent = '';
        }
         if (isLoggedIn && loginModalOverlay?.classList.contains('visible')) { hideLoginModal(); }
    }
    async function checkSession() {
        console.log("Checking session via /api/verify-session...");
        try {
            const response = await fetch('/api/verify-session');
            if (!response.ok) { console.error('Session check failed:', response.status); updateUI(false); return false; }
            const data = await response.json();
            updateUI(data.loggedIn, data.name);
            return data.loggedIn;
        } catch (error) { console.error('Network error checkSession:', error); updateUI(false); return false; }
     }
    function showLoginModal() {
         if (!loginModalOverlay) return;
         console.log("Showing login modal.");
         if(loginForm) loginForm.reset();
         if(loginErrorMessage) { loginErrorMessage.textContent = ''; loginErrorMessage.style.display = 'none'; }
         loginModalOverlay.classList.add('visible');
         loginModalOverlay.setAttribute('aria-hidden', 'false');
         if (nameInput) nameInput.focus();
     }
    function hideLoginModal() {
        if (!loginModalOverlay) return;
        console.log("Hiding login modal.");
        loginModalOverlay.classList.remove('visible');
        loginModalOverlay.setAttribute('aria-hidden', 'true');
        resetLoginAttemptState();
        pendingLoginDetails = null;
    }
    function showConfirmationModal() {
         if (!confirmationModalOverlay) return;
         console.log("Showing confirmation modal.");
         confirmationModalOverlay.classList.add('visible');
         confirmationModalOverlay.setAttribute('aria-hidden', 'false');
         if (confirmProceedBtn) { confirmProceedBtn.disabled = false; confirmProceedBtn.innerHTML = '<span class="icon">✔️</span> Proceed'; confirmProceedBtn.focus(); }
         if (confirmCancelBtn) confirmCancelBtn.disabled = false;
    }
    function hideConfirmationModal() {
         if (!confirmationModalOverlay) return;
         console.log("Hiding confirmation modal.");
         confirmationModalOverlay.classList.remove('visible');
         confirmationModalOverlay.setAttribute('aria-hidden', 'true');
    }
    function resetLoginAttemptState(errorMessage = '') {
         isLoginPending = false;
         if (loginSubmitBtn) { loginSubmitBtn.disabled = false; loginSubmitBtn.innerHTML = '<span class="icon">🚀</span> Login'; }
         if (loginErrorMessage) { loginErrorMessage.textContent = errorMessage; loginErrorMessage.style.display = errorMessage ? 'block' : 'none'; }
    }
    function setStatusMessage(element, message, type = null) {
        if (!element) return;
        element.textContent = message;
        element.className = 'status-message'; // Reset
        if (type === 'error') element.classList.add('error');
        else if (type === 'loading') element.classList.add('loading');
        else if (type === 'success') element.classList.add('success');
        element.style.display = message ? 'block' : 'none';
    }
    async function performLoginRequest(name, email, password, forceLogin = false) {
        const body = { name, email, password, forceLogin };
        console.log(`Sending login request. Force = ${forceLogin}`);
        try {
            const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            console.log(`Login response status: ${response.status}`);
            return response;
        } catch (error) { console.error('Fetch error login:', error); throw error; }
    }
    async function handleLoginSubmit(event) {
        event.preventDefault();
        if (isLoginPending || !nameInput || !emailInput || !passwordInput) return;
        const name = nameInput.value.trim(); const email = emailInput.value.trim(); const password = passwordInput.value.trim();
        if (!name || !email || !password) { resetLoginAttemptState('Please fill in all fields.'); return; }
        isLoginPending = true; loginSubmitBtn.disabled = true; loginSubmitBtn.innerHTML = '<span class="icon">⏳</span> Verifying...'; setStatusMessage(loginErrorMessage, 'Attempting login...', 'loading'); pendingLoginDetails = { name, email, password };
        try {
            const response = await performLoginRequest(name, email, password, false);
            const body = await response.json().catch(()=>null);
            if (response.ok) { hideLoginModal(); await checkSession(); }
            else if (response.status === 401) { resetLoginAttemptState('Invalid Email or Password.'); pendingLoginDetails = null; }
            else if (response.status === 409) { setStatusMessage(loginErrorMessage, 'Session conflict detected.', 'error'); showConfirmationModal(); }
            else { resetLoginAttemptState(body?.error || `Login failed (${response.status})`); pendingLoginDetails = null;}
        } catch (e) { resetLoginAttemptState('Network error.'); pendingLoginDetails = null; }
        finally { if (!isLoginPending && loginSubmitBtn?.disabled && !confirmationModalOverlay?.classList.contains('visible')) { resetLoginAttemptState(); } } // Ensure reset if not waiting for confirmation
    }
    async function handleForcedLogin() {
        if (!pendingLoginDetails || !confirmProceedBtn || !confirmCancelBtn) return;
        confirmProceedBtn.disabled = true; confirmProceedBtn.innerHTML = '<span class="icon">⏳</span> Processing...'; confirmCancelBtn.disabled = true;
        const { name, email, password } = pendingLoginDetails;
        try {
            const response = await performLoginRequest(name, email, password, true);
            if (response.ok) { hideConfirmationModal(); hideLoginModal(); await checkSession(); }
            else { const body = await response.json().catch(()=>null); hideConfirmationModal(); resetLoginAttemptState(body?.error || 'Override failed.'); }
        } catch (e) { hideConfirmationModal(); resetLoginAttemptState('Network error during override.'); }
        finally { isLoginPending = false; pendingLoginDetails = null; if(confirmProceedBtn) { confirmProceedBtn.disabled = false; confirmProceedBtn.innerHTML = '<span class="icon">✔️</span> Proceed';} if(confirmCancelBtn)confirmCancelBtn.disabled = false; }
    }
    async function handleLogout() {
        if (!logoutBtn) return;
        logoutBtn.disabled = true; logoutBtn.innerHTML = '<span class="icon">⏳</span> Logging out...';
        try { await fetch('/api/logout', { method: 'POST' }); } catch (e) { console.error('Logout error:', e); }
        finally { updateUI(false); }
    }
    async function handleProceed() {
        if (!proceedBtn || !proceedStatusMsg) return;
        proceedBtn.disabled = true; proceedBtn.innerHTML = '<span class="icon">⏳</span> Checking Access...'; setStatusMessage(proceedStatusMsg, 'Verifying your session...', 'loading');
        try {
            const isLoggedIn = await checkSession();
            if (isLoggedIn) { setStatusMessage(proceedStatusMsg, 'Access granted. Redirecting...', 'success'); setTimeout(() => { window.location.href = 'b.html'; }, 300); }
            else { setStatusMessage(proceedStatusMsg, 'Access denied. Please log in first.', 'error'); proceedBtn.disabled = false; proceedBtn.innerHTML = '<span class="icon">💰</span> पैसा कमाउन सुरु गर्नुहोस्'; } // Restore Nepali text
        } catch (e) { setStatusMessage(proceedStatusMsg, 'Error checking session.', 'error'); proceedBtn.disabled = false; proceedBtn.innerHTML = '<span class="icon">💰</span> पैसा कमाउन सुरु गर्नुहोस्';} // Restore Nepali text
     }

    // --- Demo Section Functions (Corrected & Updated) ---

    /**
     * Validates the odds input fields for the demo.
     * Uses the exact values defined in EXPECTED_ODDS.
     * Shows error messages using showInputError helper.
     * @returns {object|null} - Object with parsed odds if valid, null otherwise.
     */
    function validateDemoOdds() {
        let isValid = true;
        const odds = {};
        const inputs = [
            { input: site1W1OddsInput, error: site1W1Error, key: 'site1_w1' }, // 1xBet Kings
            { input: site1W2OddsInput, error: site1W2Error, key: 'site1_w2' }, // 1xBet Lucknow
            { input: site2W1OddsInput, error: site2W1Error, key: 'site2_w1' }, // BC Lucknow
            { input: site2W2OddsInput, error: site2W2Error, key: 'site2_w2' }, // BC Kings
        ];

        // Clear previous errors
        inputs.forEach(item => clearInputError(item.error));
        clearInputError(totalAmountError);

        inputs.forEach(item => {
            if (!item.input || !item.error) {
                console.error(`Demo Validate: Missing input or error element for ${item.key}`);
                isValid = false; return;
            }
            const value = parseFloat(item.input.value);
            const expected = EXPECTED_ODDS[item.key];

            if (isNaN(value)) {
                showInputError(item.error, 'कृपया अंक राख्नुहोस्।');
                isValid = false;
            } else if (value !== expected) {
                showInputError(item.error, `उदाहरणको लागि, कृपया ${expected} राख्नुहोला।`);
                isValid = false;
            } else {
                odds[item.key] = value; // Store valid odd
            }
        });

         // Validate Total Amount
         if (!totalAmountInput || !totalAmountError) {
            console.error("Demo Validate: Missing total amount input or error element."); isValid = false;
         } else {
            const totalAmount = parseFloat(totalAmountInput.value);
            if (isNaN(totalAmount) || totalAmount <= 0) {
                showInputError(totalAmountError, 'कृपया ० भन्दा ठूलो रकम राख्नुहोस्।');
                isValid = false;
            } else {
                odds.totalAmount = totalAmount; // Add valid amount
            }
         }

        return isValid ? odds : null;
    }

    /**
     * Calculates arbitrage opportunity based on four odds and total amount.
     * Finds the best odds for each outcome across both sites.
     * @param {number} s1w1 - Site 1, Kings Odd
     * @param {number} s1w2 - Site 1, Lucknow Odd
     * @param {number} s2w1 - Site 2, Lucknow Odd
     * @param {number} s2w2 - Site 2, Kings Odd
     * @param {number} totalAmount - Total amount to invest.
     * @returns {object} - Calculation result object.
     */
    function calculateArbitrage(s1w1, s1w2, s2w1, s2w2, totalAmount) {
        // Find the best odds for each outcome (Team)
        const bestOdd_Kings = Math.max(s1w1, s2w2); // Compare Kings odds on 1xBet (s1w1) vs BC.Game (s2w2)
        const bestOdd_Lucknow = Math.max(s1w2, s2w1); // Compare Lucknow odds on 1xBet (s1w2) vs BC.Game (s2w1)

        // Determine which site offers the best odd for each team
        const site_Kings = (bestOdd_Kings === s1w1) ? "1xBet" : "BC.Game";
        const site_Lucknow = (bestOdd_Lucknow === s1w2) ? "1xBet" : "BC.Game";

        // Calculate the margin using the BEST odds found
        const margin = (1 / bestOdd_Kings) + (1 / bestOdd_Lucknow);
        const isArbitrage = margin < 1;
        console.log(`Arbitrage Calc: Margin = ${margin.toFixed(5)} (Arb: ${isArbitrage})`);

        if (isArbitrage) {
            const stake_Kings = (totalAmount / bestOdd_Kings) / margin;
            const stake_Lucknow = (totalAmount / bestOdd_Lucknow) / margin;
            const profit = (totalAmount / margin) - totalAmount;

            // Structure for consistency (A=Kings, B=Lucknow for this example)
            return {
                isArbitrage: true, profit: profit, margin: margin, totalAmount: totalAmount,
                stakeA: stake_Kings, siteA: site_Kings, teamA: "Kings XI Punjab", oddA: bestOdd_Kings,
                stakeB: stake_Lucknow, siteB: site_Lucknow, teamB: "Lucknow Super Giant", oddB: bestOdd_Lucknow,
            };
        } else {
            return { isArbitrage: false, profit: 0, margin: margin };
        }
    }

    /**
    * Updates the labels for the fixed bet radio buttons based on calculation result.
    * @param {object} demoCalc - The result object from calculateArbitrage.
    */
    function updateFixedBetLabels(demoCalc) {
       if (!fixedTeamALabel || !fixedTeamBLabel || !demoCalc || !demoCalc.isArbitrage) {
           // Hide labels or set default text if no valid calculation
           if(fixedTeamALabel) fixedTeamALabel.textContent = 'टीम A फिक्स';
           if(fixedTeamBLabel) fixedTeamBLabel.textContent = 'टीम B फिक्स';
           return;
       };
       // Set labels based on which team/site corresponds to A and B in the calculation
       fixedTeamALabel.textContent = `${demoCalc.siteA} मा ${demoCalc.teamA} मा`; // e.g., BC.Game मा Kings XI Punjab मा
       fixedTeamBLabel.textContent = `${demoCalc.siteB} मा ${demoCalc.teamB} मा`; // e.g., 1xBet मा Lucknow Super Giant मा
    }


    /**
     * Displays the results of the main demo calculation.
     * @param {object} result - The result object from calculateArbitrage.
     */
    function displayDemoResults(result) {
        if (!demoResultsDiv || !resultMessageEl || !resultDetailsEl || !resultProfitEl || !showFixedBetBtn) return;

        resultDetailsEl.innerHTML = ''; // Clear previous details
        resultProfitEl.textContent = '';
        updateFixedBetLabels(result); // Update labels based on new result (or clear them if no arb)
        // Ensure fixed bet section is hidden initially when results are updated
        if(fixedBetSectionDiv) fixedBetSectionDiv.style.display = 'none';
        if(fixedBetResultsDiv) fixedBetResultsDiv.style.display = 'none';


        if (result.isArbitrage) {
            resultMessageEl.textContent = 'यसबाट पैसा कमाउन सकिन्छ!';
            resultMessageEl.classList.remove('error');

            // Team A (Kings in demo)
            const p1 = document.createElement('p');
            p1.innerHTML = `${result.siteA} मा ${result.teamA} मा <strong>रु. ${result.stakeA.toFixed(2)}</strong> लाउनुहोस्`;
            // Team B (Lucknow in demo)
            const p2 = document.createElement('p');
            p2.innerHTML = `अनि ${result.siteB} मा ${result.teamB} मा <strong>रु. ${result.stakeB.toFixed(2)}</strong> लाउनुहोस्`;

            resultDetailsEl.appendChild(p1);
            resultDetailsEl.appendChild(p2);

            resultProfitEl.textContent = `यसो गर्दा तपाईंलाई जम्मा रु. ${result.totalAmount.toFixed(2)} लगानीमा पक्का रु. ${result.profit.toFixed(2)} को फाइदा हुन्छ।`;
            resultProfitEl.style.color = '#28a745'; // Ensure profit text is green

            showFixedBetBtn.style.display = 'inline-flex';
        } else {
            resultMessageEl.textContent = 'यो Odds बाट निश्चित फाइदा छैन। (Margin: ' + result.margin.toFixed(4) + ')';
            resultMessageEl.classList.add('error');
            resultProfitEl.textContent = ''; // No profit to show
            showFixedBetBtn.style.display = 'none';
        }

        demoResultsDiv.style.display = 'block';
        lastDemoCalculation = result; // Store even if no arbitrage (contains margin)
    }

    /** Event handler for the main demo calculation button. */
    function handleCalculateDemo() {
        console.log("Calculate demo button clicked.");
        const validatedOdds = validateDemoOdds(); // Includes total amount

        if (validatedOdds) {
            console.log("Demo odds validated:", validatedOdds);
            const calculationResult = calculateArbitrage(
                validatedOdds.site1_w1, validatedOdds.site1_w2,
                validatedOdds.site2_w1, validatedOdds.site2_w2,
                validatedOdds.totalAmount
            );
            console.log("Arbitrage calculation result:", calculationResult);
            displayDemoResults(calculationResult);
             if (demoResultsDiv) demoResultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            console.log("Demo odds validation failed.");
             if (demoResultsDiv) demoResultsDiv.style.display = 'none';
             if (showFixedBetBtn) showFixedBetBtn.style.display = 'none';
             if (fixedBetSectionDiv) fixedBetSectionDiv.style.display = 'none';
             lastDemoCalculation = null;
        }
    }

    /** Event handler for the "Show Fixed Bet Section" button. */
     function handleShowFixedBet() {
         if (!fixedBetSectionDiv) return;
         console.log("Show fixed bet section button clicked.");
         fixedBetSectionDiv.style.display = 'block';
         fixedBetSectionDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
     }

    /** Validates the fixed bet inputs. */
     function validateFixedBet() {
        let isValid = true;
        let selectedTeamValue = null;
        clearInputError(fixedTeamError); clearInputError(fixedAmountError);

        fixedBetRadioButtons.forEach(radio => { if (radio.checked) selectedTeamValue = radio.value; });
        if (!selectedTeamValue) { showInputError(fixedTeamError, 'कृपया एउटा टिम छान्नुहोस्।'); isValid = false; }

        const fixedAmount = parseFloat(fixedAmountInput?.value);
        if (!fixedAmountInput || !fixedAmountError) { console.error("Fixed amount elements missing."); isValid = false; }
        else if (isNaN(fixedAmount) || fixedAmount <= 0) { showInputError(fixedAmountError, 'कृपया ० भन्दा ठूलो रकम राख्नुहोस्।'); isValid = false; }

        return isValid ? { fixedTeamValue: selectedTeamValue, fixedAmount: fixedAmount } : null;
     }

     /** Calculates the required stake for the second bet based on a fixed first bet. */
     function calculateFixedBet(fixedTeamValue, fixedAmount, demoCalc) {
        if (!demoCalc || !demoCalc.isArbitrage) { console.error("Cannot calc fixed bet: No prior valid arb calc."); return null; }

        let fixedOdd, otherOdd, fixedSite, fixedTeam, otherSite, otherTeam;
        // Use A/B structure from stored calculation
        if (fixedTeamValue === 'teamA') { // Fixing bet on Team A (Kings in demo)
            ({ oddA: fixedOdd, oddB: otherOdd, siteA: fixedSite, teamA: fixedTeam, siteB: otherSite, teamB: otherTeam } = demoCalc);
        } else if (fixedTeamValue === 'teamB') { // Fixing bet on Team B (Lucknow in demo)
            ({ oddB: fixedOdd, oddA: otherOdd, siteB: fixedSite, teamB: fixedTeam, siteA: otherSite, teamA: otherTeam } = demoCalc);
        } else { console.error("Invalid fixedTeamValue:", fixedTeamValue); return null; }

        const potentialReturn = fixedAmount * fixedOdd;
        const otherStake = potentialReturn / otherOdd;
        return { fixedSite, fixedTeam, fixedAmount, otherSite, otherTeam, otherStake };
     }

     /** Displays the results of the fixed bet calculation. */
      function displayFixedBetResults(result) {
         if (!fixedBetResultsDiv) return;
         if (result) {
             fixedBetResultsDiv.innerHTML = `
                 <p>यदि तपाईंले ${result.fixedSite} मा ${result.fixedTeam} मा <strong>रु. ${result.fixedAmount.toFixed(2)}</strong> लगाउनुहुन्छ भने,</p>
                 <p>तपाईंले ${result.otherSite} मा ${result.otherTeam} मा <strong>रु. ${result.otherStake.toFixed(2)}</strong> लगाउनु पर्छ।</p>
                 <p>(तपाईंको जम्मा लगानी रु. ${(result.fixedAmount + result.otherStake).toFixed(2)} हुन्छ।)</p> `;
             fixedBetResultsDiv.style.display = 'block';
         } else {
             fixedBetResultsDiv.innerHTML = `<p class="error-message visible">हिसाब गर्न मिलेन। कृपया फेरि प्रयास गर्नुहोस्।</p>`;
             fixedBetResultsDiv.style.display = 'block';
         }
      }

     /** Event handler for the fixed bet calculation button. */
     function handleCalculateFixed() {
        console.log("Calculate fixed bet button clicked.");
         if (!lastDemoCalculation || !lastDemoCalculation.isArbitrage) {
            showInputError(fixedTeamError, "कृपया पहिले माथिको 'पैसा कमाउन सकिन्छ कि नाइँ...' बटन थिच्नुहोस्।");
            return;
         }
         const validatedFixed = validateFixedBet();
         if (validatedFixed) {
            console.log("Fixed bet inputs validated:", validatedFixed);
            const fixedResult = calculateFixedBet(validatedFixed.fixedTeamValue, validatedFixed.fixedAmount, lastDemoCalculation);
            console.log("Fixed bet calculation result:", fixedResult);
            displayFixedBetResults(fixedResult);
            if (fixedBetResultsDiv) fixedBetResultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
         } else {
            console.log("Fixed bet validation failed.");
            if(fixedBetResultsDiv) fixedBetResultsDiv.style.display = 'none';
         }
     }

     /** Handles click on the "Try it" button/link for smooth scrolling. */
     function handleTryItClick(event) {
        event.preventDefault();
        const demoSection = document.getElementById('demo-start');
        if (demoSection) {
            console.log("Scrolling to demo section.");
            demoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
     }

    // --- Event Listeners Setup ---
    // Login/Session Listeners
    if (loginHeaderBtn) loginHeaderBtn.addEventListener('click', showLoginModal);
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', hideLoginModal);
    if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (proceedBtn) proceedBtn.addEventListener('click', handleProceed);
    if (confirmProceedBtn) confirmProceedBtn.addEventListener('click', handleForcedLogin);
    if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', () => { hideConfirmationModal(); resetLoginAttemptState('Login cancelled.'); isLoginPending = false; pendingLoginDetails = null; });
    if (loginModalOverlay) loginModalOverlay.addEventListener('click', (e) => { if (e.target === loginModalOverlay) hideLoginModal(); });
    if (confirmationModalOverlay) confirmationModalOverlay.addEventListener('click', (e) => { if (e.target === confirmationModalOverlay) { hideConfirmationModal(); resetLoginAttemptState('Login cancelled.'); isLoginPending = false; pendingLoginDetails = null;} });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { /* ... (escape key logic) ... */ } });

    // Demo Section Listeners
    if (calculateDemoBtn) calculateDemoBtn.addEventListener('click', handleCalculateDemo);
    if (showFixedBetBtn) showFixedBetBtn.addEventListener('click', handleShowFixedBet);
    if (calculateFixedBtn) calculateFixedBtn.addEventListener('click', handleCalculateFixed);
    tryItButtons.forEach(button => button.addEventListener('click', handleTryItClick));

     // Listeners to clear errors/results on input change
     [site1W1OddsInput, site1W2OddsInput, site2W1OddsInput, site2W2OddsInput, totalAmountInput, fixedAmountInput].forEach(input => {
         if (input) {
             input.addEventListener('input', () => {
                 const errorEl = document.getElementById(input.id + '-error');
                 if (errorEl) clearInputError(errorEl);
                 // Hide all results when any input changes
                 if (demoResultsDiv) demoResultsDiv.style.display = 'none';
                 if (showFixedBetBtn) showFixedBetBtn.style.display = 'none';
                 if (fixedBetSectionDiv) fixedBetSectionDiv.style.display = 'none';
                 if (fixedBetResultsDiv) fixedBetResultsDiv.style.display = 'none';
                 lastDemoCalculation = null; // Invalidate stored calc
             });
         }
     });
     fixedBetRadioButtons.forEach(radio => {
        radio.addEventListener('change', () => {
            clearInputError(fixedTeamError);
            if(fixedBetResultsDiv) fixedBetResultsDiv.style.display = 'none'; // Clear fixed results on radio change
        });
     });


    // --- Initial Session Check ---
    console.log("Running initial session check on page load...");
    checkSession();

}); // --- End DOMContentLoaded ---
