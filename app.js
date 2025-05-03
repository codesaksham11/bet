// /app.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("App JS Loaded - v3 (with Demo Logic)");

    // --- DOM Elements (Login/Session related - Keep As Is) ---
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

    // --- DOM Elements (NEW: Demo Section) ---
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
    const tryItButtons = document.querySelectorAll('.try-button'); // Use querySelectorAll if multiple

    // --- State (Keep Existing) ---
    let isLoginPending = false;
    let pendingLoginDetails = null;

    // --- Constants (NEW: Demo Expected Values) ---
    const EXPECTED_ODDS = {
        site1_w1: 1.749,
        site1_w2: 2.112,
        site2_w1: 1.86,
        site2_w2: 2.08
    };
    // Store calculated demo results to reuse in fixed bet calculation
    let lastDemoCalculation = null;


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

    // --- Login/Session Functions (Keep As Is from previous version) ---
    function updateUI(isLoggedIn, userName = null) { /* ... Keep implementation ... */
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
    async function checkSession() { /* ... Keep implementation ... */
        console.log("Checking session via /api/verify-session...");
        try {
            const response = await fetch('/api/verify-session');
            if (!response.ok) { console.error('Session check failed:', response.status); updateUI(false); return false; }
            const data = await response.json();
            updateUI(data.loggedIn, data.name);
            return data.loggedIn;
        } catch (error) { console.error('Network error checkSession:', error); updateUI(false); return false; }
     }
    function showLoginModal() { /* ... Keep implementation ... */
         if (!loginModalOverlay) return;
         console.log("Showing login modal.");
         if(loginForm) loginForm.reset();
         if(loginErrorMessage) { loginErrorMessage.textContent = ''; loginErrorMessage.style.display = 'none'; }
         loginModalOverlay.classList.add('visible');
         loginModalOverlay.setAttribute('aria-hidden', 'false');
         if (nameInput) nameInput.focus();
     }
    function hideLoginModal() { /* ... Keep implementation ... */
        if (!loginModalOverlay) return;
        console.log("Hiding login modal.");
        loginModalOverlay.classList.remove('visible');
        loginModalOverlay.setAttribute('aria-hidden', 'true');
        resetLoginAttemptState();
        pendingLoginDetails = null;
    }
    function showConfirmationModal() { /* ... Keep implementation ... */
         if (!confirmationModalOverlay) return;
         console.log("Showing confirmation modal.");
         confirmationModalOverlay.classList.add('visible');
         confirmationModalOverlay.setAttribute('aria-hidden', 'false');
         if (confirmProceedBtn) { confirmProceedBtn.disabled = false; confirmProceedBtn.innerHTML = '<span class="icon">✔️</span> Proceed'; confirmProceedBtn.focus(); }
         if (confirmCancelBtn) confirmCancelBtn.disabled = false;
    }
    function hideConfirmationModal() { /* ... Keep implementation ... */
         if (!confirmationModalOverlay) return;
         console.log("Hiding confirmation modal.");
         confirmationModalOverlay.classList.remove('visible');
         confirmationModalOverlay.setAttribute('aria-hidden', 'true');
    }
    function resetLoginAttemptState(errorMessage = '') { /* ... Keep implementation ... */
         isLoginPending = false;
         if (loginSubmitBtn) { loginSubmitBtn.disabled = false; loginSubmitBtn.innerHTML = '<span class="icon">🚀</span> Login'; }
         if (loginErrorMessage) { loginErrorMessage.textContent = errorMessage; loginErrorMessage.style.display = errorMessage ? 'block' : 'none'; }
    }
    function setStatusMessage(element, message, type = null) { /* ... Keep implementation ... */
        if (!element) return;
        element.textContent = message;
        element.className = 'status-message'; // Reset
        if (type === 'error') element.classList.add('error');
        else if (type === 'loading') element.classList.add('loading');
        else if (type === 'success') element.classList.add('success');
        element.style.display = message ? 'block' : 'none';
    }
    async function performLoginRequest(name, email, password, forceLogin = false) { /* ... Keep implementation ... */
        const body = { name, email, password, forceLogin };
        console.log(`Sending login request. Force = ${forceLogin}`);
        try {
            const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            console.log(`Login response status: ${response.status}`);
            return response;
        } catch (error) { console.error('Fetch error login:', error); throw error; }
    }
    async function handleLoginSubmit(event) { /* ... Keep implementation ... */
        event.preventDefault();
        if (isLoginPending || !nameInput || !emailInput || !passwordInput) return;
        const name = nameInput.value.trim(); const email = emailInput.value.trim(); const password = passwordInput.value.trim();
        if (!name || !email || !password) { resetLoginAttemptState('Please fill in all fields.'); return; }
        isLoginPending = true; /*...*/ pendingLoginDetails = { name, email, password };
        try {
            const response = await performLoginRequest(name, email, password, false);
            const body = await response.json().catch(()=>null);
            if (response.ok) { hideLoginModal(); await checkSession(); }
            else if (response.status === 401) { resetLoginAttemptState('Invalid Email or Password.'); pendingLoginDetails = null; }
            else if (response.status === 409) { setStatusMessage(loginErrorMessage, 'Session conflict detected.', 'error'); showConfirmationModal(); }
            else { resetLoginAttemptState(body?.error || `Login failed (${response.status})`); pendingLoginDetails = null;}
        } catch (e) { resetLoginAttemptState('Network error.'); pendingLoginDetails = null; }
        finally { if (!isLoginPending && loginSubmitBtn?.disabled) resetLoginAttemptState(); }
    }
    async function handleForcedLogin() { /* ... Keep implementation ... */
        if (!pendingLoginDetails || !confirmProceedBtn || !confirmCancelBtn) return;
        confirmProceedBtn.disabled = true; /*...*/ confirmCancelBtn.disabled = true;
        const { name, email, password } = pendingLoginDetails;
        try {
            const response = await performLoginRequest(name, email, password, true);
            if (response.ok) { hideConfirmationModal(); hideLoginModal(); await checkSession(); }
            else { const body = await response.json().catch(()=>null); hideConfirmationModal(); resetLoginAttemptState(body?.error || 'Override failed.'); }
        } catch (e) { hideConfirmationModal(); resetLoginAttemptState('Network error during override.'); }
        finally { isLoginPending = false; pendingLoginDetails = null; if(confirmProceedBtn)confirmProceedBtn.disabled = false;/*...*/ if(confirmCancelBtn)confirmCancelBtn.disabled = false; }
    }
    async function handleLogout() { /* ... Keep implementation ... */
        if (!logoutBtn) return;
        logoutBtn.disabled = true; /*...*/
        try { await fetch('/api/logout', { method: 'POST' }); } catch (e) { console.error('Logout error:', e); }
        finally { updateUI(false); }
    }
    async function handleProceed() { /* ... Keep implementation ... */
        if (!proceedBtn || !proceedStatusMsg) return;
        proceedBtn.disabled = true; /*...*/ setStatusMessage(proceedStatusMsg, 'Verifying session...', 'loading');
        try {
            const isLoggedIn = await checkSession();
            if (isLoggedIn) { setStatusMessage(proceedStatusMsg, 'Access granted. Redirecting...', 'success'); setTimeout(() => { window.location.href = 'b.html'; }, 300); }
            else { setStatusMessage(proceedStatusMsg, 'Access denied. Please log in first.', 'error'); proceedBtn.disabled = false; proceedBtn.innerHTML = '<span class="icon">🚀</span> पैसा कमाउन सुरु गर्नुहोस्'; }
        } catch (e) { setStatusMessage(proceedStatusMsg, 'Error checking session.', 'error'); proceedBtn.disabled = false; proceedBtn.innerHTML = '<span class="icon">🚀</span> पैसा कमाउन सुरु गर्नुहोस्';}
     }

    // --- NEW: Demo Section Functions ---

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
            { input: site1W1OddsInput, error: site1W1Error, key: 'site1_w1' },
            { input: site1W2OddsInput, error: site1W2Error, key: 'site1_w2' },
            { input: site2W1OddsInput, error: site2W1Error, key: 'site2_w1' },
            { input: site2W2OddsInput, error: site2W2Error, key: 'site2_w2' },
        ];

        // Clear previous errors
        inputs.forEach(item => clearInputError(item.error));
        clearInputError(totalAmountError);

        inputs.forEach(item => {
            if (!item.input || !item.error) {
                console.error(`Missing input or error element for ${item.key}`);
                isValid = false;
                return; // Skip if elements are missing
            }
            const value = parseFloat(item.input.value);
            const expected = EXPECTED_ODDS[item.key];

            if (isNaN(value)) {
                showInputError(item.error, 'कृपया अंक राख्नुहोस्।');
                isValid = false;
            } else if (value !== expected) {
                // Specific error message for incorrect demo value
                showInputError(item.error, `उदाहरणको लागि, कृपया ${expected} राख्नुहोला।`);
                isValid = false;
            } else {
                odds[item.key] = value; // Store the valid numeric odd
            }
        });

         // Validate Total Amount
         const totalAmount = parseFloat(totalAmountInput.value);
         if (!totalAmountInput || !totalAmountError) {
            console.error("Missing total amount input or error element.");
            isValid = false;
         } else if (isNaN(totalAmount) || totalAmount <= 0) {
            showInputError(totalAmountError, 'कृपया ० भन्दा ठूलो रकम राख्नुहोस्।');
            isValid = false;
         } else {
            odds.totalAmount = totalAmount; // Add valid total amount
         }


        return isValid ? odds : null;
    }

    /**
     * Calculates arbitrage opportunity based on four odds and total amount.
     * FOR DEMO: Uses hardcoded logic assuming Site 2 W1 vs Site 1 W2 is the arb.
     * @param {number} s1w1 - Site 1, Win 1 Odd
     * @param {number} s1w2 - Site 1, Win 2 Odd
     * @param {number} s2w1 - Site 2, Win 1 Odd
     * @param {number} s2w2 - Site 2, Win 2 Odd
     * @param {number} totalAmount - Total amount to invest.
     * @returns {object} - Calculation result object.
     */
    function calculateArbitrage(s1w1, s1w2, s2w1, s2w2, totalAmount) {
        // For the demo, we KNOW the arbitrage is between s2w1 and s1w2
        const oddA = s2w1; // Best odd for outcome 1 (Kings Win on BC.Game)
        const oddB = s1w2; // Best odd for outcome 2 (Lucknow Win on 1xBet)

        const margin = (1 / oddA) + (1 / oddB);
        const isArbitrage = margin < 1;

        if (isArbitrage) {
            const stakeA = (totalAmount / oddA) / margin; // Stake on Kings @ BC.Game
            const stakeB = (totalAmount / oddB) / margin; // Stake on Lucknow @ 1xBet
            const profit = (totalAmount / margin) - totalAmount;
             // For display purposes
             const siteA = "BC.Game";
             const teamA = "Kings XI Punjab";
             const siteB = "1xBet";
             const teamB = "Lucknow Super Giant";

            return {
                isArbitrage: true,
                profit: profit,
                stakeA: stakeA,
                stakeB: stakeB,
                siteA: siteA,
                teamA: teamA,
                oddA: oddA,
                siteB: siteB,
                teamB: teamB,
                oddB: oddB,
                margin: margin,
                totalAmount: totalAmount
            };
        } else {
             // This case shouldn't happen with the fixed demo odds if entered correctly
            return {
                isArbitrage: false,
                profit: 0,
                margin: margin
            };
        }
    }

    /**
     * Displays the results of the main demo calculation.
     * @param {object} result - The result object from calculateArbitrage.
     */
    function displayDemoResults(result) {
        if (!demoResultsDiv || !resultMessageEl || !resultDetailsEl || !resultProfitEl || !showFixedBetBtn) {
            console.error("Demo result elements not found.");
            return;
        }

        // Clear previous results
        resultDetailsEl.innerHTML = '';
        resultProfitEl.textContent = '';

        if (result.isArbitrage) {
            resultMessageEl.textContent = 'यसबाट पैसा कमाउन सकिन्छ!';
            resultMessageEl.classList.remove('error'); // Ensure no error class

            const p1 = document.createElement('p');
            p1.innerHTML = `${result.siteB} मा ${result.teamB} मा <strong>रु. ${result.stakeB.toFixed(2)}</strong> लाउनुहोस्`;
            const p2 = document.createElement('p');
            p2.innerHTML = `अनि ${result.siteA} मा ${result.teamA} मा <strong>रु. ${result.stakeA.toFixed(2)}</strong> लाउनुहोस्`;

            resultDetailsEl.appendChild(p1);
            resultDetailsEl.appendChild(p2);

            resultProfitEl.textContent = `यसो गर्दा तपाईंलाई जम्मा रु. ${result.totalAmount.toFixed(2)} लगानीमा पक्का रु. ${result.profit.toFixed(2)} को फाइदा हुन्छ।`;

            showFixedBetBtn.style.display = 'inline-flex'; // Show the fixed bet button
        } else {
            resultMessageEl.textContent = 'यो Odds बाट निश्चित फाइदा छैन।';
            resultMessageEl.classList.add('error');
            showFixedBetBtn.style.display = 'none'; // Hide fixed bet button
        }

        demoResultsDiv.style.display = 'block'; // Show the results section
        lastDemoCalculation = result; // Store for fixed bet calculation
    }


    /**
     * Event handler for the main demo calculation button.
     */
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
            // Scroll to results smoothly
             if (demoResultsDiv) {
                 demoResultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
             }
        } else {
            console.log("Demo odds validation failed.");
             // Hide results if validation fails
             if (demoResultsDiv) demoResultsDiv.style.display = 'none';
             if (showFixedBetBtn) showFixedBetBtn.style.display = 'none';
             if (fixedBetSectionDiv) fixedBetSectionDiv.style.display = 'none'; // Hide fixed bet too
             lastDemoCalculation = null;
        }
    }


    /**
     * Event handler for the "Show Fixed Bet Section" button.
     */
     function handleShowFixedBet() {
         if (!fixedBetSectionDiv) return;
         console.log("Show fixed bet section button clicked.");
         fixedBetSectionDiv.style.display = 'block';
         // Scroll to the fixed bet section
         fixedBetSectionDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
         // Optionally hide the button itself after clicking
         // if (showFixedBetBtn) showFixedBetBtn.style.display = 'none';
     }

    /**
     * Validates the fixed bet inputs (team selection and amount).
     * @returns {object|null} - Object with fixedTeam and fixedAmount if valid, null otherwise.
     */
     function validateFixedBet() {
        let isValid = true;
        let selectedTeamValue = null;

        clearInputError(fixedTeamError);
        clearInputError(fixedAmountError);

        // Check radio button selection
        fixedBetRadioButtons.forEach(radio => {
            if (radio.checked) {
                selectedTeamValue = radio.value; // e.g., "site1_w2" or "site2_w1"
            }
        });

        if (!selectedTeamValue) {
            showInputError(fixedTeamError, 'कृपया एउटा टिम छान्नुहोस्।');
            isValid = false;
        }

        // Check fixed amount
        const fixedAmount = parseFloat(fixedAmountInput?.value);
        if (!fixedAmountInput || !fixedAmountError) {
            console.error("Fixed amount input or error element missing.");
            isValid = false;
        } else if (isNaN(fixedAmount) || fixedAmount <= 0) {
            showInputError(fixedAmountError, 'कृपया ० भन्दा ठूलो रकम राख्नुहोस्।');
            isValid = false;
        }

        return isValid ? { fixedTeamValue: selectedTeamValue, fixedAmount: fixedAmount } : null;
     }

     /**
      * Calculates the required stake for the second bet based on a fixed first bet.
      * Requires results from the initial demo calculation.
      * @param {string} fixedTeamValue - The value of the selected radio button ('site1_w2' or 'site2_w1').
      * @param {number} fixedAmount - The amount the user wants to bet on the fixed team.
      * @param {object} demoCalc - The result object from the last successful calculateArbitrage call.
      * @returns {object|null} - Calculation details or null if inputs are invalid.
      */
     function calculateFixedBet(fixedTeamValue, fixedAmount, demoCalc) {
        if (!demoCalc || !demoCalc.isArbitrage) {
            console.error("Cannot calculate fixed bet without a valid previous arbitrage calculation.");
            return null;
        }

        let fixedOdd, otherOdd, fixedSite, fixedTeam, otherSite, otherTeam;

        // Determine which odds/teams/sites correspond to the fixed bet
        if (fixedTeamValue === 'site1_w2') { // Fixing bet on Lucknow @ 1xBet
            fixedOdd = demoCalc.oddB;
            otherOdd = demoCalc.oddA;
            fixedSite = demoCalc.siteB;
            fixedTeam = demoCalc.teamB;
            otherSite = demoCalc.siteA;
            otherTeam = demoCalc.teamA;
        } else if (fixedTeamValue === 'site2_w1') { // Fixing bet on Kings @ BC.Game
            fixedOdd = demoCalc.oddA;
            otherOdd = demoCalc.oddB;
            fixedSite = demoCalc.siteA;
            fixedTeam = demoCalc.teamA;
            otherSite = demoCalc.siteB;
            otherTeam = demoCalc.teamB;
        } else {
            console.error("Invalid fixedTeamValue:", fixedTeamValue);
            return null; // Invalid selection
        }

        // Calculate the required stake on the other side to match potential payout
        const potentialReturn = fixedAmount * fixedOdd;
        const otherStake = potentialReturn / otherOdd;

        return {
             fixedSite: fixedSite,
             fixedTeam: fixedTeam,
             fixedAmount: fixedAmount,
             otherSite: otherSite,
             otherTeam: otherTeam,
             otherStake: otherStake
        };
     }

     /**
      * Displays the results of the fixed bet calculation.
      * @param {object} result - The result object from calculateFixedBet.
      */
      function displayFixedBetResults(result) {
         if (!fixedBetResultsDiv) return;

         if (result) {
             fixedBetResultsDiv.innerHTML = `
                 <p>यदि तपाईंले ${result.fixedSite} मा ${result.fixedTeam} मा <strong>रु. ${result.fixedAmount.toFixed(2)}</strong> लगाउनुहुन्छ भने,</p>
                 <p>तपाईंले ${result.otherSite} मा ${result.otherTeam} मा <strong>रु. ${result.otherStake.toFixed(2)}</strong> लगाउनु पर्छ।</p>
                 <p>(यसो गर्दा तपाईंको कुल लगानी रु. ${(result.fixedAmount + result.otherStake).toFixed(2)} हुन्छ र नाफा उही रहन्छ।)</p>
             `;
             fixedBetResultsDiv.style.display = 'block';
         } else {
             // Should only happen if calculation failed unexpectedly
             fixedBetResultsDiv.innerHTML = `<p class="error-message visible">हिसाब गर्न मिलेन। कृपया फेरि प्रयास गर्नुहोस्।</p>`;
             fixedBetResultsDiv.style.display = 'block';
         }
      }

     /**
      * Event handler for the fixed bet calculation button.
      */
     function handleCalculateFixed() {
        console.log("Calculate fixed bet button clicked.");
         if (!lastDemoCalculation || !lastDemoCalculation.isArbitrage) {
            showInputError(fixedTeamError, "कृपया पहिले माथिको 'पैसा कमाउन सकिन्छ कि नाइँ' बटन थिच्नुहोस्।");
            return;
         }

         const validatedFixed = validateFixedBet();
         if (validatedFixed) {
            console.log("Fixed bet inputs validated:", validatedFixed);
            const fixedResult = calculateFixedBet(
                validatedFixed.fixedTeamValue,
                validatedFixed.fixedAmount,
                lastDemoCalculation // Use stored result from main demo calc
            );
            console.log("Fixed bet calculation result:", fixedResult);
            displayFixedBetResults(fixedResult);
            if (fixedBetResultsDiv) {
                fixedBetResultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
         } else {
            console.log("Fixed bet validation failed.");
             if(fixedBetResultsDiv) fixedBetResultsDiv.style.display = 'none'; // Hide results on validation fail
         }
     }

     /**
      * Handles click on the "Try it" button/link for smooth scrolling.
      */
     function handleTryItClick(event) {
        event.preventDefault(); // Prevent default anchor link behavior
        const demoSection = document.getElementById('demo-start');
        if (demoSection) {
            console.log("Scrolling to demo section.");
            demoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
     }


    // --- Event Listeners (Login/Session - Keep As Is) ---
    if (loginHeaderBtn) loginHeaderBtn.addEventListener('click', showLoginModal);
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', hideLoginModal);
    if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (proceedBtn) proceedBtn.addEventListener('click', handleProceed);
    if (confirmProceedBtn) confirmProceedBtn.addEventListener('click', handleForcedLogin);
    if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', () => { hideConfirmationModal(); resetLoginAttemptState('Login cancelled.'); isLoginPending = false; pendingLoginDetails = null; });
    if (loginModalOverlay) loginModalOverlay.addEventListener('click', (e) => { if (e.target === loginModalOverlay) hideLoginModal(); });
    if (confirmationModalOverlay) confirmationModalOverlay.addEventListener('click', (e) => { if (e.target === confirmationModalOverlay) { hideConfirmationModal(); resetLoginAttemptState('Login cancelled.'); isLoginPending = false; pendingLoginDetails = null;} });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (confirmationModalOverlay?.classList.contains('visible')) { hideConfirmationModal(); resetLoginAttemptState('Login cancelled.'); isLoginPending = false; pendingLoginDetails = null; } else if (loginModalOverlay?.classList.contains('visible')) { hideLoginModal(); } } });


    // --- Event Listeners (NEW: Demo Section) ---
    if (calculateDemoBtn) {
        calculateDemoBtn.addEventListener('click', handleCalculateDemo);
    } else { console.error("#calculate-demo-btn not found!"); }

    if (showFixedBetBtn) {
        showFixedBetBtn.addEventListener('click', handleShowFixedBet);
    } else { console.error("#show-fixed-bet-btn not found!"); }

    if (calculateFixedBtn) {
        calculateFixedBtn.addEventListener('click', handleCalculateFixed);
    } else { console.error("#calculate-fixed-btn not found!"); }

     // Add listeners to clear errors on input
     [site1W1OddsInput, site1W2OddsInput, site2W1OddsInput, site2W2OddsInput, totalAmountInput, fixedAmountInput].forEach(input => {
         if (input) {
             input.addEventListener('input', () => {
                 // Find the corresponding error element based on ID convention
                 const errorEl = document.getElementById(input.id + '-error');
                 if (errorEl) {
                     clearInputError(errorEl);
                 }
                  // Also clear general results when inputs change
                  if (demoResultsDiv) demoResultsDiv.style.display = 'none';
                  if (showFixedBetBtn) showFixedBetBtn.style.display = 'none';
                  if (fixedBetSectionDiv) fixedBetSectionDiv.style.display = 'none';
                  if (fixedBetResultsDiv) fixedBetResultsDiv.style.display = 'none';
                  lastDemoCalculation = null; // Reset stored calculation
             });
         }
     });
     // Listener for radio buttons to clear team error
     fixedBetRadioButtons.forEach(radio => {
        radio.addEventListener('change', () => {
            clearInputError(fixedTeamError);
             // Clear fixed bet results when selection changes
             if(fixedBetResultsDiv) fixedBetResultsDiv.style.display = 'none';
        });
     });

     // Listener for "Try it" button(s)
     tryItButtons.forEach(button => {
        button.addEventListener('click', handleTryItClick);
     });


    // --- Initial Session Check on Page Load ---
    console.log("Running initial session check on page load...");
    checkSession();

}); // --- End DOMContentLoaded ---
