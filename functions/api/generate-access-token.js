// /functions/api/generate-access-token.js

/**
 * Helper function to parse a specific cookie from the Request headers.
 * (Identical to the one in verify-session.js)
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
 * Generates a secure random UUID using the Web Crypto API for access tokens.
 * @returns {string} A UUID string.
 */
function generateAccessTokenUUID() {
    // Use the global crypto object provided by the Workers runtime
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    } else {
        // Fallback (Highly unlikely in modern CF Workers)
        console.error("generate-access-token.js: crypto.randomUUID not available. Using Math.random fallback (INSECURE).");
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

/**
 * Handles POST requests to generate a short-lived access token.
 * Requires a valid 'session_token' cookie.
 * Issues an 'access_token' cookie.
 * @param {EventContext<Env, any, any>} context - The function context.
 */
export async function onRequestPost(context) {
    const { request, env } = context;
    const functionName = "[generate-access-token]"; // For logging clarity

    console.log(`${functionName} Received request.`);

    // --- KV Bindings ---
    // Requires SESSION_ID (to verify the long-lived session)
    // and ACCESS_TOKENS (to store the short-lived token)
    const SESSION_ID = env.SESSION_ID;
    const ACCESS_TOKENS = env.ACCESS_TOKENS;

    // --- Check if KV Bindings are present ---
    if (!SESSION_ID || !ACCESS_TOKENS) {
        console.error(`${functionName} CRITICAL ERROR: Missing KV Bindings! SESSION_ID and ACCESS_TOKENS are required.`);
        return new Response(JSON.stringify({ error: 'Server configuration error' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }

    // --- Configuration ---
    const ACCESS_TOKEN_TTL_SECONDS = 300; // 5 minutes (Keep this relatively short)

    try {
        // --- Step 1: Verify the Long-Lived Session ---
        const sessionToken = getCookie(request, 'session_token');

        if (!sessionToken) {
            console.log(`${functionName} Access denied. No 'session_token' cookie found.`);
            // User needs to be logged in first.
            return new Response(JSON.stringify({ error: 'Not authenticated. No session found.' }), {
                status: 401, // Unauthorized
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log(`${functionName} Found 'session_token' cookie: ${sessionToken.substring(0,8)}... Attempting verification.`);

        // --- Step 2: Look up session token in SESSION_ID KV ---
        const sessionDataJson = await SESSION_ID.get(sessionToken);

        if (!sessionDataJson) {
            console.log(`${functionName} Access denied. Session token ${sessionToken.substring(0, 8)}*** is invalid or expired.`);
            // The session token provided is bad, clear it from the browser.
            const clearHeaders = new Headers({ 'Content-Type': 'application/json' });
            clearHeaders.append('Set-Cookie', `session_token=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`);
            return new Response(JSON.stringify({ error: 'Invalid or expired session. Please log in again.' }), {
                status: 401, // Unauthorized
                headers: clearHeaders
            });
        }

        console.log(`${functionName} Session token ${sessionToken.substring(0,8)}... verified in SESSION_ID.`);

        // --- Step 3: Parse Session Data ---
        let sessionData;
        try {
            sessionData = JSON.parse(sessionDataJson);
            // Validate expected structure (must contain at least email for the access token)
            if (!sessionData || typeof sessionData.email !== 'string') {
                throw new Error("Invalid session data format stored in SESSION_ID. Expected object with 'email'.");
            }
            console.log(`${functionName} Valid session found for user ${sessionData.email}. Proceeding to generate access token.`);
        } catch (parseError) {
            console.error(`${functionName} CRITICAL ERROR parsing session data for token ${sessionToken.substring(0, 8)}***. Data: ${sessionDataJson}`, parseError);
            // Don't leak internal details
            return new Response(JSON.stringify({ error: 'Internal server error processing session data.' }), {
                status: 500, headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- Step 4: Generate the Short-Lived Access Token ---
        const accessToken = generateAccessTokenUUID();
        console.log(`${functionName} Issuing new access token '${accessToken.substring(0, 8)}***' for user ${sessionData.email}.`);

        // --- Step 5: Store Access Token Data in ACCESS_TOKENS KV ---
        // Store relevant user info (like email) needed by the protected resource (b.html's backend?)
        const accessTokenData = JSON.stringify({
            email: sessionData.email,
            // You could add the original session token here if needed for auditing, but keep data minimal
            // associatedSessionToken: sessionToken,
            issuedAt: Date.now()
        });

        try {
            await ACCESS_TOKENS.put(accessToken, accessTokenData, {
                expirationTtl: ACCESS_TOKEN_TTL_SECONDS
            });
            console.log(`${functionName} Stored access token in ACCESS_TOKENS KV with TTL ${ACCESS_TOKEN_TTL_SECONDS}s.`);
        } catch (kvPutError) {
             console.error(`${functionName} CRITICAL ERROR: Failed to store access token in KV. User: ${sessionData.email}`, kvPutError);
             return new Response(JSON.stringify({ error: 'Failed to generate access token. Please try again.' }), {
                status: 500, headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- Step 6: Set the Access Token Cookie ---
        const responseHeaders = new Headers();
        responseHeaders.append('Content-Type', 'application/json');
        // Set HttpOnly cookie for the access token as well
        responseHeaders.append(
            'Set-Cookie',
            `access_token=${accessToken}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${ACCESS_TOKEN_TTL_SECONDS}`
            // Note: Path=/ might need adjustment if b.html or its API calls are under a specific sub-path
        );

        // --- Step 7: Return Success Response ---
        console.log(`${functionName} Access token generated and cookie set successfully.`);
        return new Response(JSON.stringify({
            message: 'Access token generated successfully.',
            status: 'success'
            // No need to send the token in the body if it's in the cookie
        }), {
            status: 200,
            headers: responseHeaders
        });

    } catch (error) {
        console.error(`${functionName} UNEXPECTED ERROR in generate-access-token handler:`, error);
        return new Response(JSON.stringify({ error: 'An unexpected internal server error occurred.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * Main request handler. Routes based on method.
 * Handles POST for token generation and OPTIONS for CORS preflight.
 * @param {EventContext<Env, any, any>} context - The function context.
 */
export async function onRequest(context) {
    const { request } = context;

    if (request.method === "POST") {
        return await onRequestPost(context);
    }

    if (request.method === "OPTIONS") {
        // Handle CORS preflight requests - needed for the frontend POST request
        return new Response(null, {
            status: 204,
            headers: {
                // IMPORTANT: Adjust Allow-Origin in production!
                "Access-Control-Allow-Origin": "*", // Or "https://your-frontend-domain.com"
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type", // Allow 'Content-Type'
                "Access-Control-Allow-Credentials": "true", // Necessary for cookies
                "Access-Control-Max-Age": "86400",
            }
        });
    }

    // Reject other methods
    return new Response('Method Not Allowed', {
        status: 405,
        headers: { 'Allow': 'POST, OPTIONS' }
    });
}
