// /functions/b.html.js

/**
 * Helper function to parse a specific cookie from the Request headers.
 * (Identical to the one in other files)
 * @param {Request} request - The incoming Request object.
 * @param {string} name - The name of the cookie to retrieve.
 * @returns {string | null} - The value of the cookie or null if not found.
 */
function getCookie(request, name) {
    let result = null;
    const cookieString = request.headers.get('Cookie');
    if (cookieString) {
        const cookies = cookieString.split(';');
        cookies.forEach(cookie => {
            const parts = cookie.split('=');
            const cookieName = decodeURIComponent(parts.shift()?.trim() || '');
            if (cookieName === name) {
                result = decodeURIComponent(parts.join('=').trim());
            }
        });
    }
    return result;
}

/**
 * Generates the HTML response for access denied errors.
 * @param {string} nepaliTitle - The main error title in Nepali.
 * @param {string} nepaliMessage - The detailed error message in Nepali.
 * @returns {Response} - An HTML response object.
 */
function createAccessDeniedResponse(nepaliTitle, nepaliMessage) {
    const html = `
<!DOCTYPE html>
<html lang="ne">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${nepaliTitle}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Noto Sans Devanagari', sans-serif;
            background-color: #f8f9fa;
            color: #343a40;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            text-align: center;
            padding: 20px;
            box-sizing: border-box;
        }
        .container {
            background-color: #ffffff;
            padding: 30px 40px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
            max-width: 500px;
            width: 100%;
        }
        .icon {
            font-size: 3rem;
            color: #dc3545; /* Red for error */
            margin-bottom: 15px;
        }
        h1 {
            color: #dc3545;
            margin-bottom: 10px;
            font-size: 1.8rem;
        }
        p {
            font-size: 1.1rem;
            margin-bottom: 25px;
            color: #6c757d;
        }
        .button {
            display: inline-block;
            padding: 12px 25px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            text-decoration: none;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s ease;
        }
        .button:hover {
            background-color: #0056b3;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">❌</div>
        <h1>${nepaliTitle}</h1>
        <p>${nepaliMessage}</p>
        <a href="/" class="button">मुख्य पृष्ठमा फर्कनुहोस्</a>
    </div>
</body>
</html>
    `;
    return new Response(html, {
        status: 403, // Forbidden
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}


/**
 * Middleware function for /b.html.
 * Verifies the 'access_token' cookie before allowing access.
 * @param {EventContext<Env, any, any>} context - The function context.
 */
export async function onRequest(context) {
    const { request, env, next } = context;
    const functionName = "[b.html middleware]"; // For logging

    // This middleware should primarily protect GET requests for the page
    if (request.method !== 'GET') {
        console.log(`${functionName} Passing through non-GET request (${request.method}).`);
        // Allow other methods (like OPTIONS for potential CORS, or POST if b.html had forms)
        // If b.html APIs need protection, they should have their own middleware or check
        return next(); // Pass control to the next handler (e.g., static asset server)
    }

    console.log(`${functionName} Intercepting GET request for /b.html.`);

    // --- KV Binding ---
    // Needs ACCESS_TOKENS KV to verify the token
    const ACCESS_TOKENS = env.ACCESS_TOKENS;

    if (!ACCESS_TOKENS) {
        console.error(`${functionName} CRITICAL ERROR: Missing KV Binding! ACCESS_TOKENS is required.`);
        // Show a generic server error page if KV is missing
        return createAccessDeniedResponse(
            'सर्भर त्रुटि',
            'पृष्ठ लोड गर्न आवश्यक कन्फिगरेसन मिलेन। कृपया पछि प्रयास गर्नुहोस्।'
        );
    }

    // --- Step 1: Check for the access_token cookie ---
    const accessToken = getCookie(request, 'access_token');

    if (!accessToken) {
        console.log(`${functionName} Access denied: 'access_token' cookie missing.`);
        return createAccessDeniedResponse(
            'पहुँच अस्वीकृत',
            'यो पृष्ठ प्रयोग गर्न तपाईंको पहुँच छैन वा समाप्त भएको छ।'
        );
    }

    console.log(`${functionName} Found 'access_token': ${accessToken.substring(0,8)}... Verifying.`);

    // --- Step 2: Verify the token against ACCESS_TOKENS KV ---
    try {
        const tokenData = await ACCESS_TOKENS.get(accessToken);

        if (!tokenData) {
            console.log(`${functionName} Access denied: Token ${accessToken.substring(0,8)}... not found in KV (invalid or expired).`);
            // Although the token exists in cookie, it's not valid server-side.
            // We could clear the bad access_token cookie here too, but the denied page is sufficient.
            return createAccessDeniedResponse(
                'पहुँच अस्वीकृत',
                'यो पृष्ठ प्रयोग गर्न तपाईंको पहुँच छैन वा समाप्त भएको छ।'
            );
        }

        // Optional: Could parse tokenData if needed (e.g., logging user email)
        // const parsedData = JSON.parse(tokenData);
        // console.log(`${functionName} Access granted for token ${accessToken.substring(0,8)}... (Email: ${parsedData?.email || 'N/A'})`);

        console.log(`${functionName} Access granted for token ${accessToken.substring(0,8)}...`);

        // --- Step 3: Access Granted - Proceed to serve b.html ---
        // Pass control to the default static asset handler
        return next();

    } catch (error) {
        console.error(`${functionName} UNEXPECTED ERROR during access token verification:`, error);
        return createAccessDeniedResponse(
            'आन्तरिक त्रुटि',
            'पहुँच प्रमाणीकरण गर्दा त्रुटि भयो। कृपया पछि प्रयास गर्नुहोस्।'
        );
    }
}
