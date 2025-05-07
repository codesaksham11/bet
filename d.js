document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const oneXBetLucknowOddsEl = document.getElementById('1xbet-lucknow-odds');
    const oneXBetPunjabOddsEl = document.getElementById('1xbet-punjab-odds');
    const bcGameLucknowOddsEl = document.getElementById('bcgame-lucknow-odds');
    const bcGamePunjabOddsEl = document.getElementById('bcgame-punjab-odds');
    const totalAmountEl = document.getElementById('total-amount');
    const submitButton = document.getElementById('submit-button');

    // Error Message Elements
    const error1xbetLucknowEl = document.getElementById('error-1xbet-lucknow-odds');
    const error1xbetPunjabEl = document.getElementById('error-1xbet-punjab-odds');
    const errorBcgameLucknowEl = document.getElementById('error-bcgame-lucknow-odds');
    const errorBcgamePunjabEl = document.getElementById('error-bcgame-punjab-odds');
    const errorTotalAmountEl = document.getElementById('error-total-amount');
    const globalErrorMessageEl = document.getElementById('global-error-message');

    // Result Elements
    const resultBoxEl = document.getElementById('result-box');
    const resultMessageTextEl = document.getElementById('result-message-text');

    const oddsFields = [
        { el: oneXBetLucknowOddsEl, errorEl: error1xbetLucknowEl, name: "1xbet लखनऊ ओड्स" },
        { el: oneXBetPunjabOddsEl, errorEl: error1xbetPunjabEl, name: "1xbet पञ्जाब ओड्स" },
        { el: bcGameLucknowOddsEl, errorEl: errorBcgameLucknowEl, name: "BC.game लखनऊ ओड्स" },
        { el: bcGamePunjabOddsEl, errorEl: errorBcgamePunjabEl, name: "BC.game पञ्जाब ओड्स" }
    ];

    const clearAllErrorsAndResult = () => {
        oddsFields.forEach(field => {
            if (field.errorEl) field.errorEl.textContent = '';
        });
        if (errorTotalAmountEl) errorTotalAmountEl.textContent = '';
        if (globalErrorMessageEl) globalErrorMessageEl.textContent = '';
        if (resultBoxEl) resultBoxEl.style.display = 'none';
        if (resultMessageTextEl) resultMessageTextEl.textContent = '';
    };

    submitButton.addEventListener('click', () => {
        clearAllErrorsAndResult();
        let isValid = true;
        const epsilon = 0.0001; // For floating point comparisons

        // --- Validate Odds ---
        let oddsValues = {};
        let demoConstraintFailed = false;

        oddsFields.forEach(field => {
            const valueStr = field.el.value;
            const expectedStr = field.el.dataset.expected;
            
            if (valueStr.trim() === '') { // Check for empty input
                if (field.errorEl) field.errorEl.textContent = 'कृपया ओड्स हाल्नुहोस्।';
                isValid = false;
                return; // Skip further checks for this field
            }

            const value = parseFloat(valueStr);
            const expected = parseFloat(expectedStr);

            if (isNaN(value)) {
                if (field.errorEl) field.errorEl.textContent = 'कृपया मान्य नम्बर हाल्नुहोस्।';
                isValid = false;
            } else if (Math.abs(value - expected) > epsilon) {
                if (field.errorEl) field.errorEl.textContent = 'चित्रमा लेखेको अंक मात्र मान्य हुनेछ।';
                demoConstraintFailed = true;
                isValid = false;
            }
            oddsValues[field.el.id] = value; // Store parsed value
        });

        if (demoConstraintFailed) {
            if (globalErrorMessageEl) globalErrorMessageEl.textContent = 'यो उदाहरणको लागि हो, चाहेको अंक हाल्न लगइन गर्नुहोस्।';
        }

        // --- Validate Total Amount ---
        const totalAmountStr = totalAmountEl.value;
        let totalAmount = 0;

        if (totalAmountStr.trim() === '') {
             if (errorTotalAmountEl) errorTotalAmountEl.textContent = 'कृपया लगानी रकम हाल्नुहोस्।';
             isValid = false;
        } else {
            totalAmount = parseFloat(totalAmountStr);
            if (isNaN(totalAmount) || totalAmount <= 0 || totalAmount > 9999999) {
                if (errorTotalAmountEl) errorTotalAmountEl.textContent = 'कृपया ० भन्दा बढी र ९,९९९,९९९ भन्दा कम मान्य रकम हाल्नुहोस्।';
                isValid = false;
            }
        }
        

        if (!isValid) {
            return; // Stop processing if any validation failed
        }

        // --- Arbitrage Calculation (as per identified profitable scenario) ---
        // Scenario: Bet on Lucknow (1xbet) and Punjab (BC.game)
        const O1_L = oddsValues['1xbet-lucknow-odds'];  // Expected: 2.12
        const O2_P = oddsValues['bcgame-punjab-odds']; // Expected: 2.08

        // Check for arbitrage opportunity (this combination is designed to be one)
        const sumOfInverseOdds = (1 / O1_L) + (1 / O2_P);

        if (sumOfInverseOdds >= 1) {
            // This case should ideally not happen with the demo's fixed valid odds
            if (globalErrorMessageEl) globalErrorMessageEl.textContent = 'यी ओड्सहरूसँग कुनै ग्यारेन्टी नाफाको अवसर छैन।';
            if (resultBoxEl) resultBoxEl.style.display = 'none'; // Ensure result box is hidden
            return;
        }

        const stakeOn1xbetLucknow = (totalAmount / O1_L) / sumOfInverseOdds;
        const stakeOnBcgamePunjab = (totalAmount / O2_P) / sumOfInverseOdds;
        
        // Profit calculation (should be the same for either outcome)
        // const potentialReturn = stakeOn1xbetLucknow * O1_L;
        // const profit = potentialReturn - totalAmount;
        // A more direct profit calculation:
        const profit = totalAmount * ((1 / sumOfInverseOdds) - 1);

        // --- Display Results ---
        if (resultMessageTextEl) {
            resultMessageTextEl.textContent = `हजुरले 1xbet मा लखनऊको लागि रु ${stakeOn1xbetLucknow.toFixed(2)} र BC.game मा पञ्जाबको लागि रु ${stakeOnBcgamePunjab.toFixed(2)} लगाउँदा हजुरलाई लगभग रु ${profit.toFixed(2)} फाइदा हुनेछ।`;
        }
        if (resultBoxEl) resultBoxEl.style.display = 'block';
    });
});
