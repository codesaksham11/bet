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
        appForTeam1: '', // Which app has the best odd for team 1 ('app1' or 'app2')
        appForTeam2: '', // Which app has the best odd for team 2
        teamNameForOdd1: '', // Actual team name corresponding to bestOddTeam1
        teamNameForOdd2: '', // Actual team name corresponding to bestOddTeam2
        stake1: 0,
        stake2: 0,
        profit: 0,
        totalInvestment: 0,
        margin: 1 // Default to no arbitrage
    };

    // --- Event Listeners ---

    // Sync Team Names
    app1Team1NameInput.addEventListener('input', () => syncTeamName(app1Team1NameInput, app2Team1NameInput));
    app2Team1NameInput.addEventListener('input', () => syncTeamName(app2Team1NameInput, app1Team1NameInput));
    app1Team2NameInput.addEventListener('input', () => syncTeamName(app1Team2NameInput, app2Team2NameInput));
    app2Team2NameInput.addEventListener('input', () => syncTeamName(app2Team2NameInput, app1Team2NameInput));

    // Main Check Button
    checkOpportunityBtn.addEventListener('click', handleCheckOpportunity);

    // Open Modal Button
    openAlgorithmModalBtn.addEventListener('click', openModal);

    // Calculate Safe Bet Button (in modal)
    calculateSafeBetBtn.addEventListener('click', handleCalculateSafeBet);

    // Close Modal if clicked outside content
     algorithmModal.addEventListener('click', (event) => {
        if (event.target === algorithmModal) { // Check if the click is on the overlay
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
        const messageElement = area.id === 'resultArea1' ? resultMessage1 : area; // Adjust if resultArea2 needs a specific p tag later

        // Clear previous styles/content if necessary
        resultArea1.style.display = 'none';
        resultArea2.style.display = 'none'; // Hide both initially
        resultArea1.classList.remove('result-success', 'result-fail');
        if (area.id === 'resultArea2') area.classList.remove('result-success', 'result-fail'); // Adjust if needed


        messageElement.innerHTML = message; // Use innerHTML to allow potential formatting
        area.classList.add(type === 'success' ? 'result-success' : 'result-fail');
        area.style.display = 'block';

        if (area.id === 'resultArea1') {
             resultNoteContainer.style.display = showNote ? 'block' : 'none';
        }
    }

    function validateInputs() {
        const inputs = [
            { el: app1NameInput, name: 'एप १ को नाम' }, { el: app1Team1NameInput, name: 'एप १, टिम १ नाम' },
            { el: app1Team1OddsInput, name: 'एप १, टिम १ ओड्स', isNumber: true, minValue: 1.001 },
            { el: app1Team2NameInput, name: 'एप १, टिम २ नाम' },
            { el: app1Team2OddsInput, name: 'एप १, टिम २ ओड्स', isNumber: true, minValue: 1.001 },
            { el: app2NameInput, name: 'एप २ को नाम' }, // app2Team1NameInput is synced
            { el: app2Team1OddsInput, name: 'एप २, टिम १ ओड्स', isNumber: true, minValue: 1.001 }, // app2Team2NameInput is synced
            { el: app2Team2OddsInput, name: 'एप २, टिम २ ओड्स', isNumber: true, minValue: 1.001 },
            { el: totalInvestmentInput, name: 'कुल लगानी', isNumber: true, minValue: 0.01 }
        ];

        for (const input of inputs) {
            const value = input.el.value.trim();
            if (!value) {
                return `कृपया '${input.name}' भर्नुहोस्।`;
            }
            if (input.isNumber) {
                const numValue = parseFloat(value);
                if (isNaN(numValue)) {
                    return `'${input.name}' मा संख्यात्मक मान आवश्यक छ।`;
                }
                if (input.minValue !== undefined && numValue < input.minValue) {
                     return `'${input.name}' ${input.minValue} भन्दा बढी हुनुपर्छ।`;
                }
            }
        }

        if (app1Team1NameInput.value.trim().toLowerCase() === app1Team2NameInput.value.trim().toLowerCase()) {
             return "दुबै टिमको नाम एउटै हुन सक्दैन।";
        }

        return null; // Validation passed
    }


    function handleCheckOpportunity() {
        // 1. Validate Inputs
        const validationError = validateInputs();
        if (validationError) {
            displayResult(resultArea1, validationError, 'fail');
            return;
        }

        // 2. Get Values & Store Initial State
        calculationState.app1.name = app1NameInput.value.trim();
        calculationState.app1.team1 = app1Team1NameInput.value.trim();
        calculationState.app1.odd1 = parseFloat(app1Team1OddsInput.value);
        calculationState.app1.team2 = app1Team2NameInput.value.trim();
        calculationState.app1.odd2 = parseFloat(app1Team2OddsInput.value);

        calculationState.app2.name = app2NameInput.value.trim();
        calculationState.app2.team1 = app2Team1NameInput.value.trim(); // Synced
        calculationState.app2.odd1 = parseFloat(app2Team1OddsInput.value);
        calculationState.app2.team2 = app2Team2NameInput.value.trim(); // Synced
        calculationState.app2.odd2 = parseFloat(app2Team2OddsInput.value);

        calculationState.totalInvestment = parseFloat(totalInvestmentInput.value);

        // 3. Find Best Odds for Each Outcome (Team1 wins vs Team2 wins)
        // Best odd for Team 1 to win
        if (calculationState.app1.odd1 >= calculationState.app2.odd1) {
            calculationState.bestOddTeam1 = calculationState.app1.odd1;
            calculationState.appForTeam1 = 'app1';
            calculationState.teamNameForOdd1 = calculationState.app1.team1;
        } else {
            calculationState.bestOddTeam1 = calculationState.app2.odd1;
            calculationState.appForTeam1 = 'app2';
             calculationState.teamNameForOdd1 = calculationState.app2.team1; // Should be same as app1.team1
        }

        // Best odd for Team 2 to win
        if (calculationState.app1.odd2 >= calculationState.app2.odd2) {
            calculationState.bestOddTeam2 = calculationState.app1.odd2;
            calculationState.appForTeam2 = 'app1';
            calculationState.teamNameForOdd2 = calculationState.app1.team2;
        } else {
            calculationState.bestOddTeam2 = calculationState.app2.odd2;
            calculationState.appForTeam2 = 'app2';
            calculationState.teamNameForOdd2 = calculationState.app2.team2; // Should be same as app1.team2
        }

        // 4. Check for Arbitrage
        calculationState.margin = (1 / calculationState.bestOddTeam1) + (1 / calculationState.bestOddTeam2);

        if (calculationState.margin < 1.0) { // Use 1.0 or a slightly smaller number like 0.9999 to account for float issues
            calculationState.arbitrageFound = true;

            // 5. Calculate Stakes and Profit
            calculationState.stake1 = (calculationState.totalInvestment / calculationState.bestOddTeam1) / calculationState.margin;
            calculationState.stake2 = (calculationState.totalInvestment / calculationState.bestOddTeam2) / calculationState.margin;
            // Profit = Guaranteed Return - Total Investment
            // Guaranteed Return = stake1 * bestOddTeam1 (or stake2 * bestOddTeam2)
            // Guaranteed Return = (totalInvestment / margin)
            calculationState.profit = (calculationState.totalInvestment / calculationState.margin) - calculationState.totalInvestment;

            // 6. Display Success Result
            const appName1 = calculationState.appForTeam1 === 'app1' ? calculationState.app1.name : calculationState.app2.name;
            const appName2 = calculationState.appForTeam2 === 'app1' ? calculationState.app1.name : calculationState.app2.name;

            const message = `
                <strong>बधाई छ! पैसा कमाउन सकिन्छ।</strong><br>
                '${appName1}' को '${calculationState.teamNameForOdd1}' मा रु ${calculationState.stake1.toFixed(2)} लगाउनुहोस्।<br>
                '${appName2}' को '${calculationState.teamNameForOdd2}' मा रु ${calculationState.stake2.toFixed(2)} लगाउनुहोस्।<br>
                <hr>
                कुल लगानी: रु ${(calculationState.stake1 + calculationState.stake2).toFixed(2)}<br>
                निश्चित न्यूनतम फाइदा: <strong>रु ${calculationState.profit.toFixed(2)}</strong>
            `;
            displayResult(resultArea1, message, 'success', true);

        } else {
            // 7. Display Failure Result
            calculationState.arbitrageFound = false;
            const message = `
                माफ गर्नुहोस्, हाल कुनै पैसा कमाउने मौका छैन।<br>
                यसमा पैसा लगाउँदा तपाईंलाई घाटा जान सक्छ। (Margin: ${calculationState.margin.toFixed(4)})
            `;
            displayResult(resultArea1, message, 'fail', false);
        }
    }

    function openModal() {
        if (!calculationState.arbitrageFound) {
             alert("कृपया पहिले कमाउने मौका छ कि छैन जाँच गर्नुहोस्।");
             return;
        }
        // Populate modal app names
        modalApp1NameSpan.textContent = calculationState.app1.name || 'एप १';
        modalApp2NameSpan.textContent = calculationState.app2.name || 'एप २';

        // Clear previous selections/inputs in modal
        prefApp1Radio.checked = false;
        prefApp2Radio.checked = false;
        usualBetAmountInput.value = '';

        // Show modal
        algorithmModal.style.display = 'block';
    }

     function closeModal() {
         algorithmModal.style.display = 'none';
     }

    // Function to round stake: neglect decimal, change last digit to 0 or 5
    function roundStakeAntiAlgo(amount) {
        if (amount <= 0) return 0;
        const floorAmount = Math.floor(amount);
        const lastDigit = floorAmount % 10;
        let roundedAmount;
        if (lastDigit < 3) { // 0, 1, 2 -> round down to 0
            roundedAmount = floorAmount - lastDigit;
        } else if (lastDigit < 8) { // 3, 4, 5, 6, 7 -> round to 5
            roundedAmount = floorAmount - lastDigit + 5;
        } else { // 8, 9 -> round up to next 10 (effectively 0)
            roundedAmount = floorAmount - lastDigit + 10;
        }
        return Math.max(0, roundedAmount); // Ensure it doesn't go negative if original was small
    }


    function handleCalculateSafeBet() {
        // 1. Get Modal Inputs
        const preferredAppElement = document.querySelector('input[name="preferredApp"]:checked');
        const usualBetStr = usualBetAmountInput.value.trim();

        // 2. Validate Modal Inputs
        if (!preferredAppElement) {
            alert("कृपया हजुरलाई मन पर्ने एप छान्नुहोस्।");
            return;
        }
        if (!usualBetStr || isNaN(parseFloat(usualBetStr)) || parseFloat(usualBetStr) <= 0) {
            alert("कृपया 'प्रायः लगाउने पैसा' मा मान्य सकारात्मक रकम भर्नुहोस्।");
            return;
        }

        const preferredAppValue = preferredAppElement.value; // 'app1' or 'app2'
        const S_preferred = parseFloat(usualBetStr); // User's preferred stake amount

        // 3. Identify Preferred and Other App details from stored state
        let prefOdd, otherOdd, prefTeamName, otherTeamName, prefAppName, otherAppName;

        // Determine which *original best odd* corresponds to the preferred app selection
        // Case 1: User prefers the app that had the best odd for Team 1
        if ((preferredAppValue === 'app1' && calculationState.appForTeam1 === 'app1') || (preferredAppValue === 'app2' && calculationState.appForTeam1 === 'app2')) {
            prefOdd = calculationState.bestOddTeam1;
            prefTeamName = calculationState.teamNameForOdd1;
            prefAppName = preferredAppValue === 'app1' ? calculationState.app1.name : calculationState.app2.name;

            otherOdd = calculationState.bestOddTeam2;
            otherTeamName = calculationState.teamNameForOdd2;
            otherAppName = preferredAppValue === 'app1' ? calculationState.app2.name : calculationState.app1.name; // The *other* app name
        }
        // Case 2: User prefers the app that had the best odd for Team 2
        else {
             prefOdd = calculationState.bestOddTeam2;
             prefTeamName = calculationState.teamNameForOdd2;
             prefAppName = preferredAppValue === 'app1' ? calculationState.app1.name : calculationState.app2.name;

             otherOdd = calculationState.bestOddTeam1;
             otherTeamName = calculationState.teamNameForOdd1;
             otherAppName = preferredAppValue === 'app1' ? calculationState.app2.name : calculationState.app1.name; // The *other* app name
        }


        // 4. Calculate the theoretical stake for the *other* app based on S_preferred
        // To get equal return: S_preferred * prefOdd = O_calculated * otherOdd
        const O_calculated = (S_preferred * prefOdd) / otherOdd;

        // 5. Round O_calculated according to the rule (neglect decimal, last digit to 5/0)
        // Custom rounding: floor, then adjust last digit to nearest 5 or 0
        const O_rounded = roundStakeAntiAlgo(O_calculated);


        // 6. Test 9 Stake Variations
        const variations = [
            { s_adj: 0, o_adj: 0 }, { s_adj: 0, o_adj: -5 }, { s_adj: 0, o_adj: 5 },
            { s_adj: -10, o_adj: 0 }, { s_adj: -10, o_adj: -5 }, { s_adj: -10, o_adj: 5 },
            { s_adj: 10, o_adj: 0 }, { s_adj: 10, o_adj: -5 }, { s_adj: 10, o_adj: 5 }
        ];

        let bestProfit = -Infinity;
        let bestStakeS = 0;
        let bestStakeO = 0;
        let bestTotalStake = 0;
        let bestVariationFound = false;

        for (const v of variations) {
            const currentS = S_preferred + v.s_adj;
            const currentO = O_rounded + v.o_adj;

            // Ensure stakes are positive
            if (currentS <= 0 || currentO <= 0) {
                continue;
            }

            const totalStake = currentS + currentO;
            const returnIfPrefWins = currentS * prefOdd;
            const returnIfOtherWins = currentO * otherOdd;
            const minReturn = Math.min(returnIfPrefWins, returnIfOtherWins);
            const profit = minReturn - totalStake;

            // Track the combination with the highest minimum profit
            if (profit > bestProfit) {
                bestProfit = profit;
                bestStakeS = currentS;
                bestStakeO = currentO;
                bestTotalStake = totalStake;
                bestVariationFound = true;
            }
        }

        // 7. Display Final Result
        if (bestVariationFound && bestProfit >= 0) { // Only show if a profitable variation was found
             const finalMessage = `
                <h3>अल्गोरिदमबाट बचेर पैसा लाउने तरिका:</h3>
                <p><strong>'${prefAppName}'</strong> को <strong>'${prefTeamName}'</strong> मा: <strong>रु ${bestStakeS.toFixed(2)}</strong> लगाउनुहोस्।</p>
                <p><strong>'${otherAppName}'</strong> को <strong>'${otherTeamName}'</strong> मा: <strong>रु ${bestStakeO.toFixed(2)}</strong> लगाउनुहोस्।</p>
                <hr>
                <p>हजुरको कुल लगानी: <strong>रु ${bestTotalStake.toFixed(2)}</strong></p>
                <p>हजुरको न्यूनतम फाइदा: <strong>रु ${bestProfit.toFixed(2)}</strong></p>
             `;
             displayResult(resultArea2, finalMessage, 'success');
        } else {
             const finalMessage = `
                माफ गर्नुहोस्, तपाईंले दिनुभएको 'प्रायः लगाउने पैसा' (रु ${S_preferred.toFixed(2)}) को आधारमा, अल्गोरिदमबाट बच्दै फाइदाजनक हुने कुनै लगानी समायोजन फेला परेन। <br>
                तपाईंले फरक रकम प्रयास गर्न सक्नुहुन्छ वा सुरुको सिफारिस अनुसार लगानी गर्न सक्नुहुन्छ (तर जोखिम ख्याल राख्नुहोला)।
             `;
             displayResult(resultArea2, finalMessage, 'fail');
        }

        // 8. Close Modal
        closeModal();
    }

}); // End DOMContentLoaded
