// /functions/api/generate-access-token.js

// --- Removed Node.js crypto import ---
// import { randomUUID } from 'node:crypto';

/**
 * Helper function to parse cookies from the Request headers.
 * (This function remains unchanged)
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
            const cookieName = parts.shift()?.trim();
            const cookieValue = parts.join('=').trim();
            if (cookieName === name) {
                result = cookieValue;
            }
        });
    }
    return result;
}

/**
 * Generates a secure random UUID using the standard Web Crypto API.
 * Provides a basic fallback if somehow crypto.randomUUID isn't available.
 * @returns {string} A UUID string.
 */
function generateTokenUUID() {
    // *** Use the global crypto object provided by the Workers runtime ***
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    } else {
        // Fallback if somehow crypto.randomUUID is not available (highly unlikely in modern CF Workers)
        console.error("Web Crypto API (crypto.randomUUID) not available. Using insecure fallback.");
        // Keep the Math.random fallback as a last resort.
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

/**
 * Handles POST requests to generate a short-lived access token.
 * Verifies the long-lived session_token before issuing.
 * (Rest of the function remains the same as the previous version)
 * @param {EventContext<Env, Params, Data>} context - The function context.
 */
export async function onRequestPost(context) {
    const { request, env } = context;

    // --- KV Bindings ---
    const SESSION_ID = env.SESSION_ID;
    const ACCESS_TOKENS = env.ACCESS_TOKENS; // Ensure this KV namespace is created and bound

    if (!SESSION_ID || !ACCESS_TOKENS) {
        console.error("generate-access-token: Missing KV Bindings! Requires SESSION_ID and ACCESS_TOKENS.");
        return new Response(JSON.stringify({ error: 'Server configuration error' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }

    // --- Configuration ---
    const ACCESS_TOKEN_TTL_SECONDS = 300; // 5 minutes

    console.log("Received request to generate access token.");

    try {
        // --- Step 1: Verify the Long-Lived Session ---
        const sessionToken = getCookie(request, 'session_token');
        if (!sessionToken) {
            console.log("generate-access-token: Access denied. No 'session_token' cookie found.");
            return new Response(JSON.stringify({ error: 'Not authenticated' }), {
                status: 401, headers: { 'Content-Type': 'application/json' }
            });
        }

        const sessionDataJson = await SESSION_ID.get(sessionToken);
        if (!sessionDataJson) {
            console.log(`generate-access-token: Access denied. Session token '${sessionToken.substring(0, 8)}***' is invalid or expired.`);
            const clearHeaders = new Headers({ 'Content-Type': 'application/json' });
            clearHeaders.append('Set-Cookie', `session_token=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`);
            return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
                status: 401, headers: clearHeaders
            });
        }

        // --- Step 2: Parse Session Data ---
        let sessionData;
        try {
            sessionData = JSON.parse(sessionDataJson);
            if (!sessionData || typeof sessionData.email !== 'string') {
                throw new Error("Invalid session data format stored in SESSION_ID.");
            }
            console.log(`generate-access-token: Valid session found for user ${sessionData.email}.`);
        } catch (parseError) {
            console.error(`generate-access-token: Critical error parsing session data for token ${sessionToken.substring(0, 8)}***. Data: ${sessionDataJson}`, parseError);
            return new Response(JSON.stringify({ error: 'Internal server error processing session' }), {
                status: 500, headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- Step 3: Generate the Short-Lived Access Token ---
        // *** Calls the modified generateTokenUUID function ***
        const accessToken = generateTokenUUID();
        console.log(`generate-access-token: Issuing new access token '${accessToken.substring(0, 8)}***' for user ${sessionData.email}.`);

        // --- Step 4: Store the Access Token Temporarily ---
        const accessTokenData = JSON.stringify({
            email: sessionData.email,
            issuedAt: Date.now()
        });
        await ACCESS_TOKENS.put(accessToken, accessTokenData, {
            expirationTtl: ACCESS_TOKEN_TTL_SECONDS
        });
        console.log(`generate-access-token: Stored access token in ACCESS_TOKENS KV with TTL ${ACCESS_TOKEN_TTL_SECONDS}s.`);

        // --- Step 5: Set the Access Token Cookie ---
        const responseHeaders = new Headers();
        responseHeaders.append('Content-Type', 'application/json');
        responseHeaders.append(
            'Set-Cookie',
            `access_token=${accessToken}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${ACCESS_TOKEN_TTL_SECONDS}`
        );

        // --- Step 6: Return Success Response ---
        return new Response(JSON.stringify({
            message: 'Access token generated successfully.'
        }), {
            status: 200, headers: responseHeaders
        });

    } catch (error) {
        console.error('generate-access-token: Unexpected error:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * Main request handler for the function. Routes requests based on method.
 * Handles OPTIONS requests for CORS preflight.
 * (This function remains unchanged)
 * @param {EventContext<Env, Params, Data>} context - The function context.
 */
export async function onRequest(context) {
    if (context.request.method === "POST") {
        return await onRequestPost(context);
    }
    if (context.request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*", // Adjust for production
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "86400"
            }
        });
    }
    return new Response('Method Not Allowed', {
        status: 405, headers: { 'Allow': 'POST, OPTIONS' }
    });
}
