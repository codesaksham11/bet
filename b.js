// b.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Get DOM Elements ---
    const app1NameInput = document.getElementById('app1Name');
    const app1Team1NameInput = document.getElementById('app1Team1Name');
    const app1Team1OddsInput = document.getElementById('app1Team1Odds');
    const app1Team2NameInput = document.getElementById('app1Team2Name');
    const app1Team2OddsInput = document.getElementById('app1Team2Odds');

    const app2NameInput = document.getElementById('app2Name');
    const app2Team1NameInput = document.getElementById('app2Team1Name');
    const app2Team1OddsInput = document.getElementById('app2Team1Odds');
    const app2Team2NameInput = document.getElementById('app2Team2Name');
    const app2Team2OddsInput = document.getElementById('app2Team2Odds');

    const totalInvestmentInput = document.getElementById('totalInvestment');
    const checkOpportunityBtn = document.getElementById('checkOpportunityBtn');

    const resultArea1 = document.getElementById('resultArea1');
    const resultMessage1 = document.getElementById('resultMessage1');
    const resultNoteContainer = document.getElementById('resultNoteContainer');
    const openAlgorithmModalBtn = document.getElementById('openAlgorithmModalBtn');

    const algorithmModal = document.getElementById('algorithmModal');
    const modalApp1NameSpan = document.getElementById('modalApp1Name');
    const modalApp2NameSpan = document.getElementById('modalApp2Name');
    const prefApp1Radio = document.getElementById('prefApp1');
    const prefApp2Radio = document.getElementById('prefApp2');
    const usualBetAmountInput = document.getElementById('usualBetAmount');
    const calculateSafeBetBtn = document.getElementById('calculateSafeBetBtn');

    const resultArea2 = document.getElementById('resultArea2');

    // --- Store Calculation State ---
    let calculationState = {
        arbitrageFound: false,
        app1: { name: '', team1: '', odd1: 0, team2: '', odd2: 0 },
        app2: { name: '', team1: '', odd1: 0, team2: '', odd2: 0 },
        bestOddTeam1: 0,
        bestOddTeam2: 0,
        appForTeam1: '',
        appForTeam2: '',
        teamNameForOdd1: '',
        teamNameForOdd2: '',
        stake1: 0,
        stake2: 0,
        profit: 0,
        totalInvestment: 0,
        margin: 1
    };

    // --- Event Listeners ---
    app1Team1NameInput.addEventListener('input', () => syncTeamName(app1Team1NameInput, app2Team1NameInput));
    app2Team1NameInput.addEventListener('input', () => syncTeamName(app2Team1NameInput, app1Team1NameInput));
    app1Team2NameInput.addEventListener('input', () => syncTeamName(app1Team2NameInput, app2Team2NameInput));
    app2Team2NameInput.addEventListener('input', () => syncTeamName(app2Team2NameInput, app1Team2NameInput));

    // MODIFIED: Event listener now points to the async wrapper
    checkOpportunityBtn.addEventListener('click', wrappedHandleCheckOpportunity); // Changed from handleCheckOpportunity

    openAlgorithmModalBtn.addEventListener('click', openModal);
    calculateSafeBetBtn.addEventListener('click', handleCalculateSafeBet);
    algorithmModal.addEventListener('click', (event) => {
        if (event.target === algorithmModal) {
            closeModal();
        }
    });

    // --- Functions ---

    function syncTeamName(sourceInput, targetInput) {
        if (sourceInput.value !== targetInput.value) {
            targetInput.value = sourceInput.value;
        }
    }

    function displayResult(area, message, type = 'fail', showNote = false) {
        const messageElement = area.id === 'resultArea1' ? resultMessage1 : area;

        resultArea1.style.display = 'none';
        resultArea2.style.display = 'none';
        resultArea1.classList.remove('result-success', 'result-fail', 'result-info'); // Added result-info removal
        resultArea2.classList.remove('result-success', 'result-fail', 'result-info');

        messageElement.innerHTML = message;
        area.classList.add(type === 'success' ? 'result-success' : (type === 'info' ? 'result-info' : 'result-fail'));
        area.style.display = 'block';

        if (area.id === 'resultArea1') {
            resultNoteContainer.style.display = showNote ? 'block' : 'none';
        }
    }

    function validateInputs() {
        const inputs = [
            { el: app1NameInput, name: 'एप १ को नाम' }, { el: app1Team1NameInput, name: 'एप १, टिम १ नाम' },
            { el: app1Team1OddsInput, name: 'एप १, टिम १ ओड्स', isNumber: true, minValue: 1.00001 },
            { el: app1Team2NameInput, name: 'एप १, टिम २ नाम' },
            { el: app1Team2OddsInput, name: 'एप १, टिम २ ओड्स', isNumber: true, minValue: 1.00001 },
            { el: app2NameInput, name: 'एप २ को नाम' },
            { el: app2Team1OddsInput, name: 'एप २, टिम १ ओड्स', isNumber: true, minValue: 1.00001 },
            { el: app2Team2OddsInput, name: 'एप २, टिम २ ओड्स', isNumber: true, minValue: 1.00001 },
            { el: totalInvestmentInput, name: 'कुल लगानी', isNumber: true, minValue: 0.01 }
        ];
        for (const input of inputs) {
            const value = input.el.value.trim();
            if (!value) return `कृपया '${input.name}' भर्नुहोस्।`;
            if (input.isNumber) {
                const numValue = parseFloat(value);
                if (isNaN(numValue)) return `'${input.name}' मा संख्यात्मक मान आवश्यक छ।`;
                if (input.minValue !== undefined && numValue < input.minValue) {
                    if (input.name.includes('ओड्स')) return `'${input.name}' 1.0 भन्दा ठ्याक्कै बढी हुनुपर्छ।`;
                    else return `'${input.name}' ${input.minValue} भन्दा बढी हुनुपर्छ।`;
                }
            }
        }
        if (app1Team1NameInput.value.trim().toLowerCase() === app1Team2NameInput.value.trim().toLowerCase()) {
            return "दुबै टिमको नाम एउटै हुन सक्दैन।";
        }
        if (!app1Team1NameInput.value.trim() || !app1Team2NameInput.value.trim()) {
            return "कृपया दुबै टिमको नाम भर्नुहोस्।";
        }
        return null;
    }

    // This is the original calculation logic, now separated.
    function performArbitrageCalculation() {
        // 1. Validate Inputs
        const validationError = validateInputs();
        if (validationError) {
            displayResult(resultArea1, validationError, 'fail');
            return; // Return here to prevent further execution and allow button state to be reset by wrapper
        }

        // Update button text to "Calculating..." since validation passed
        checkOpportunityBtn.textContent = 'गणना गर्दै...'; // Calculating...
        displayResult(resultArea1, 'विवरण गणना गर्दै...', 'info', false); // Displaying calculation message


        // 2. Get Values & Store Initial State
        calculationState.app1.name = app1NameInput.value.trim();
        calculationState.app1.team1 = app1Team1NameInput.value.trim();
        calculationState.app1.odd1 = parseFloat(app1Team1OddsInput.value);
        calculationState.app1.team2 = app1Team2NameInput.value.trim();
        calculationState.app1.odd2 = parseFloat(app1Team2OddsInput.value);

        calculationState.app2.name = app2NameInput.value.trim();
        calculationState.app2.team1 = app2Team1NameInput.value.trim();
        calculationState.app2.odd1 = parseFloat(app2Team1OddsInput.value);
        calculationState.app2.team2 = app2Team2NameInput.value.trim();
        calculationState.app2.odd2 = parseFloat(app2Team2OddsInput.value);

        calculationState.totalInvestment = parseFloat(totalInvestmentInput.value);

        // 3. Find Best Odds
        calculationState.bestOddTeam1 = 0;
        calculationState.bestOddTeam2 = 0;
        calculationState.appForTeam1 = '';
        calculationState.appForTeam2 = '';
        calculationState.teamNameForOdd1 = calculationState.app1.team1;
        calculationState.teamNameForOdd2 = calculationState.app1.team2;

        if (calculationState.app1.odd1 >= calculationState.app2.odd1) {
            calculationState.bestOddTeam1 = calculationState.app1.odd1;
            calculationState.appForTeam1 = 'app1';
        } else {
            calculationState.bestOddTeam1 = calculationState.app2.odd1;
            calculationState.appForTeam1 = 'app2';
        }
        if (calculationState.app1.odd2 >= calculationState.app2.odd2) {
            calculationState.bestOddTeam2 = calculationState.app1.odd2;
            calculationState.appForTeam2 = 'app1';
        } else {
            calculationState.bestOddTeam2 = calculationState.app2.odd2;
            calculationState.appForTeam2 = 'app2';
        }

        // 4. Check for Arbitrage Margin
        calculationState.margin = (1 / calculationState.bestOddTeam1) + (1 / calculationState.bestOddTeam2);

        if (calculationState.margin < 0.99999) {
            calculationState.arbitrageFound = true;
            calculationState.stake1 = (calculationState.totalInvestment / calculationState.bestOddTeam1) / calculationState.margin;
            calculationState.stake2 = (calculationState.totalInvestment / calculationState.bestOddTeam2) / calculationState.margin;
            calculationState.profit = (calculationState.totalInvestment / calculationState.margin) - calculationState.totalInvestment;

            const appName1 = calculationState.appForTeam1 === 'app1' ? calculationState.app1.name : calculationState.app2.name;
            const appName2 = calculationState.appForTeam2 === 'app1' ? calculationState.app1.name : calculationState.app2.name;

            if (appName1 === appName2) {
                calculationState.arbitrageFound = false;
                const message = `त्रुटि: दुबै उत्कृष्ट ओड्स एउटै एप ('${appName1}') मा भेटियो। यो अवस्थामा आर्बिट्रेज सम्भव छैन।`;
                displayResult(resultArea1, message, 'fail', false);
                return; // Return here
            }

            const message = `
                <strong>बधाई छ! पैसा कमाउने सैद्धान्तिक मौका छ।</strong><br>
                (यो केवल सैद्धान्तिक हो, अल्गोरिदमबाट बच्न तलको बटन प्रयोग गर्नुहोस्)<br><br>
                '${appName1}' को '${calculationState.teamNameForOdd1}' मा रु ${calculationState.stake1.toFixed(2)} लगाउनुहोस्।<br>
                '${appName2}' को '${calculationState.teamNameForOdd2}' मा रु ${calculationState.stake2.toFixed(2)} लगाउनुहोस्।<br>
                <hr style="margin: 10px 0;">
                कुल लगानी: रु ${(calculationState.stake1 + calculationState.stake2).toFixed(2)}<br>
                निश्चित न्यूनतम फाइदा: <strong>रु ${calculationState.profit.toFixed(2)}</strong>
            `;
            displayResult(resultArea1, message, 'success', true);
        } else {
            calculationState.arbitrageFound = false;
            const message = `
                माफ गर्नुहोस्, हाल कुनै पैसा कमाउने मौका छैन।<br>
                यसमा पैसा लगाउँदा तपाईंलाई घाटा जान सक्छ। (Margin: ${calculationState.margin.toFixed(5)})
            `;
            displayResult(resultArea1, message, 'fail', false);
        }
    }


    // NEW: Wrapper function for session check and then calculation
    async function wrappedHandleCheckOpportunity() {
        checkOpportunityBtn.disabled = true;
        checkOpportunityBtn.textContent = 'सत्र प्रमाणीकरण गर्दै...'; // Verifying session...
        displayResult(resultArea1, 'तपाईंको सत्र प्रमाणीकरण गरिँदैछ, कृपया पर्खनुहोस्...', 'info', false); // Show info message

        try {
            console.log("Verifying session for b.html action...");
            const response = await fetch('/api/verify-session', { // Assuming this endpoint exists from app.js context
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            const data = await response.json();

            if (response.ok && data.loggedIn) {
                console.log("Session verified for b.html. Proceeding to calculation.");
                // User is logged in, proceed to actual calculation
                // The performArbitrageCalculation function will handle further button text changes (e.g., "Calculating...")
                // and its own result display.
                performArbitrageCalculation();
            } else {
                // User not logged in or session invalid
                console.log("Session invalid or user not logged in for b.html action.");
                let errorMsg = 'यो सुविधा प्रयोग गर्न, तपाईं लगइन भएको हुनुपर्छ। ';
                errorMsg += `कृपया <a href="index.html" style="color: #c0392b; text-decoration: underline;">गृहपृष्ठमा जानुहोस्</a> र लगइन गर्नुहोस्।`;
                if (data && data.error) { // If backend provided a specific error
                    errorMsg = `सत्र प्रमाणीकरण असफल: ${data.error}. ` + errorMsg;
                }
                displayResult(resultArea1, errorMsg, 'fail', false);
            }
        } catch (error) {
            console.error('Network error during session verification for b.html:', error);
            displayResult(resultArea1, 'सत्र प्रमाणीकरण गर्दा नेटवर्कमा समस्या आयो। कृपया आफ्नो इन्टरनेट जडान जाँच गर्नुहोस् र फेरि प्रयास गर्नुहोस्।', 'fail', false);
        } finally {
            // Re-enable button ONLY if the process didn't naturally lead to calculation
            // If performArbitrageCalculation was called, it might still be "Calculating..."
            // This ensures if session check fails, button is reset.
            // If performArbitrageCalculation runs, it will reset the button itself upon completion or its own error.
            if (checkOpportunityBtn.textContent === 'सत्र प्रमाणीकरण गर्दै...') {
                 checkOpportunityBtn.disabled = false;
                 checkOpportunityBtn.textContent = 'कमाउन मिल्छ कि नाइँ चेक गर्नुहोस्';
            }
        }
    }


    function openModal() {
        if (!calculationState.arbitrageFound) {
            alert("कृपया पहिले कमाउने मौका छ कि छैन जाँच गर्नुहोस् र सफल नतिजा आएको हुनुपर्छ।");
            return;
        }
        modalApp1NameSpan.textContent = calculationState.app1.name || 'एप १';
        modalApp2NameSpan.textContent = calculationState.app2.name || 'एप २';
        prefApp1Radio.value = calculationState.app1.name;
        prefApp2Radio.value = calculationState.app2.name;
        prefApp1Radio.checked = false;
        prefApp2Radio.checked = false;
        usualBetAmountInput.value = '';
        algorithmModal.style.display = 'block';
        resultArea2.style.display = 'none';
    }

    function closeModal() {
        algorithmModal.style.display = 'none';
    }

    function roundStakeAntiAlgo(amount) {
        if (amount <= 0) return 0;
        const floorAmount = Math.floor(amount);
        const lastDigit = floorAmount % 10;
        let roundedAmount;
        if (lastDigit < 3) roundedAmount = floorAmount - lastDigit;
        else if (lastDigit < 8) roundedAmount = floorAmount - lastDigit + 5;
        else roundedAmount = floorAmount - lastDigit + 10;
        return Math.max(0, roundedAmount);
    }

    function handleCalculateSafeBet() {
        const preferredAppRadio = document.querySelector('input[name="preferredApp"]:checked');
        const usualBetStr = usualBetAmountInput.value.trim();

        if (!preferredAppRadio) {
            alert("कृपया हजुरलाई मन पर्ने एप छान्नुहोस्।");
            return;
        }
        if (!usualBetStr || isNaN(parseFloat(usualBetStr)) || parseFloat(usualBetStr) <= 0) {
            alert("कृपया 'प्रायः लगाउने पैसा' मा मान्य सकारात्मक रकम भर्नुहोस्।");
            return;
        }

        const preferredAppNameSelected = preferredAppRadio.value;
        const S_preferred = parseFloat(usualBetStr);

        let prefOdd, otherOdd, prefTeamName, otherTeamName, prefAppNameActual, otherAppNameActual;
        const app1IsPref = preferredAppNameSelected === calculationState.app1.name;
        const app2IsPref = preferredAppNameSelected === calculationState.app2.name;

        // Determine which app/team combination the user's "preferred app" selection aligns with
        // from the previously found best odds.

        // Scenario 1: The preferred app holds the best odd for Team 1
        if ((app1IsPref && calculationState.appForTeam1 === 'app1') || (app2IsPref && calculationState.appForTeam1 === 'app2')) {
            prefOdd = calculationState.bestOddTeam1;
            prefTeamName = calculationState.teamNameForOdd1;
            prefAppNameActual = preferredAppNameSelected; // Name of the app user actually selected in modal

            otherOdd = calculationState.bestOddTeam2;
            otherTeamName = calculationState.teamNameForOdd2;
            // Determine the *actual name* of the "other" app from the initial setup
            otherAppNameActual = (calculationState.appForTeam2 === 'app1') ? calculationState.app1.name : calculationState.app2.name;

        // Scenario 2: The preferred app holds the best odd for Team 2
        } else if ((app1IsPref && calculationState.appForTeam2 === 'app1') || (app2IsPref && calculationState.appForTeam2 === 'app2')) {
            prefOdd = calculationState.bestOddTeam2;
            prefTeamName = calculationState.teamNameForOdd2;
            prefAppNameActual = preferredAppNameSelected;

            otherOdd = calculationState.bestOddTeam1;
            otherTeamName = calculationState.teamNameForOdd1;
            otherAppNameActual = (calculationState.appForTeam1 === 'app1') ? calculationState.app1.name : calculationState.app2.name;
        } else {
             alert("त्रुटि: प्राथमिकता एप र उत्कृष्ट ओड्स मिलाउन सकिएन। यस्तो हुन सक्छ यदि तपाईंले रोज्नुभएको एपमा कुनै पनि उत्कृष्ट ओड थिएन।");
             console.error("Error matching preferred app with best odds assignments:", calculationState, preferredAppNameSelected);
             return;
        }

        if (otherOdd <= 1) { // Should have been caught by input validation, but good to double check
            alert("त्रुटि: अर्को एपको ओड्स (Odds) अमान्य छ।");
            return;
        }
        const O_calculated = (S_preferred * prefOdd) / otherOdd;
        const O_rounded = roundStakeAntiAlgo(O_calculated);

        const variations = [
            { s_adj: 0, o_adj: 0 }, { s_adj: 0, o_adj: -5 }, { s_adj: 0, o_adj: 5 },
            { s_adj: -10, o_adj: 0 }, { s_adj: -10, o_adj: -5 }, { s_adj: -10, o_adj: 5 },
            { s_adj: 10, o_adj: 0 }, { s_adj: 10, o_adj: -5 }, { s_adj: 10, o_adj: 5 }
        ];
        let bestProfit = -Infinity;
        let bestStakeS = 0, bestStakeO = 0, bestTotalStake = 0;
        let bestVariationFound = false;

        for (const v of variations) {
            const currentS = S_preferred + v.s_adj;
            const currentO = O_rounded + v.o_adj;
            if (currentS <= 0 || currentO <= 0) continue;

            const totalStake = currentS + currentO;
            const returnIfPrefWins = currentS * prefOdd;
            const returnIfOtherWins = currentO * otherOdd;
            const minReturn = Math.min(returnIfPrefWins, returnIfOtherWins);
            const profit = minReturn - totalStake;

            if (profit > bestProfit + 0.00001) {
                bestProfit = profit;
                bestStakeS = currentS;
                bestStakeO = currentO;
                bestTotalStake = totalStake;
                bestVariationFound = true;
            }
        }

        if (bestVariationFound && bestProfit >= 0) {
            const finalMessage = `
                <h3>अल्गोरिदमबाट बचेर पैसा लाउने तरिका:</h3>
                <p><strong>'${prefAppNameActual}'</strong> को <strong>'${prefTeamName}'</strong> मा: <strong>रु ${bestStakeS.toFixed(2)}</strong> लगाउनुहोस्।</p>
                <p><strong>'${otherAppNameActual}'</strong> को <strong>'${otherTeamName}'</strong> मा: <strong>रु ${bestStakeO.toFixed(2)}</strong> लगाउनुहोस्।</p>
                <hr style="margin: 10px 0;">
                <p>हजुरको कुल लगानी: <strong>रु ${bestTotalStake.toFixed(2)}</strong></p>
                <p>हजुरको न्यूनतम फाइदा: <strong>रु ${bestProfit.toFixed(2)}</strong></p>
            `;
            displayResult(resultArea2, finalMessage, 'success');
        } else {
            const finalMessage = `
                <h3>नतिजा</h3>
                माफ गर्नुहोस्, तपाईंले दिनुभएको 'प्रायः लगाउने पैसा' (रु ${S_preferred.toFixed(2)}) को आधारमा, अल्गोरिदमबाट बच्दै फाइदाजनक हुने कुनै लगानी समायोजन फेला परेन। <br>
                (${bestVariationFound ? 'सबैभन्दा राम्रो प्रयासले रु ' + bestProfit.toFixed(2) + ' घाटा दियो।' : 'कुनै मान्य समायोजन भेटिएन।'}) <br><br>
                तपाईंले फरक रकम प्रयास गर्न सक्नुहुन्छ वा सुरुको सैद्धान्तिक सिफारिस अनुसार लगानी गर्न सक्नुहुन्छ (तर जोखिम ख्याल राख्नुहोला)।
            `;
            displayResult(resultArea2, finalMessage, 'fail');
        }
        closeModal();
    }

}); // End DOMContentLoaded
