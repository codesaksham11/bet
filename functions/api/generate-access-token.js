// /functions/api/generate-access-token.js

// Import crypto for UUID generation (ensure your Cloudflare environment supports this)
// Node.js compatibility layer often provides this in Workers.
// If `node:crypto` isn't available, you might need a different UUID library or method.
import { randomUUID } from 'node:crypto';

/**
 * Helper function to parse cookies from the Request headers.
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
            const cookieValue = parts.join('=').trim(); // Handles potential '=' in value
            if (cookieName === name) {
                result = cookieValue;
            }
        });
    }
    return result;
}

/**
 * Generates a secure random UUID.
 * Provides a basic fallback if crypto.randomUUID isn't available.
 * @returns {string} A UUID string.
 */
function generateTokenUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    } else {
        // Basic fallback - consider a more robust polyfill if needed in older envs
        console.warn("Using fallback UUID generation. Consider using crypto.randomUUID.");
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}


/**
 * Handles POST requests to generate a short-lived access token.
 * Verifies the long-lived session_token before issuing.
 * @param {EventContext<Env, Params, Data>} context - The function context.
 */
export async function onRequestPost(context) {
    const { request, env } = context;

    // --- KV Bindings ---
    // SESSION_ID: Stores the long-lived session data (email, name) keyed by session_token.
    // ACCESS_TOKENS: Stores the short-lived access tokens (e.g., keyed by access_token, value can be simple like 'valid' or user email).
    const SESSION_ID = env.SESSION_ID;
    const ACCESS_TOKENS = env.ACCESS_TOKENS; // *** Ensure this KV namespace is created and bound ***

    // Check if required KV bindings are present
    if (!SESSION_ID || !ACCESS_TOKENS) {
        console.error("generate-access-token: Missing KV Bindings! Requires SESSION_ID and ACCESS_TOKENS.");
        return new Response(JSON.stringify({ error: 'Server configuration error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // --- Configuration ---
    // Define the lifetime (Time-To-Live) for the short-lived access token cookie and KV entry.
    // Example: 5 minutes = 300 seconds. Adjust as needed.
    const ACCESS_TOKEN_TTL_SECONDS = 300;

    console.log("Received request to generate access token.");

    try {
        // --- Step 1: Verify the Long-Lived Session ---
        const sessionToken = getCookie(request, 'session_token');

        if (!sessionToken) {
            console.log("generate-access-token: Access denied. No 'session_token' cookie found.");
            // No long-lived session cookie, user is not authenticated at all.
            return new Response(JSON.stringify({ error: 'Not authenticated' }), {
                status: 401, // Unauthorized
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Look up the session token in the main session store (SESSION_ID KV)
        const sessionDataJson = await SESSION_ID.get(sessionToken);

        if (!sessionDataJson) {
            console.log(`generate-access-token: Access denied. Session token '${sessionToken.substring(0, 8)}***' is invalid or expired.`);
            // The session token exists in the cookie, but isn't valid on the server.
            // This could happen if the session expired or was deleted (e.g., force logout).
            // Optionally, clear the bad cookie from the user's browser for hygiene.
            const clearHeaders = new Headers({ 'Content-Type': 'application/json' });
            clearHeaders.append('Set-Cookie', `session_token=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`); // Expire the bad cookie

            return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
                status: 401, // Unauthorized
                headers: clearHeaders
            });
        }

        // --- Step 2: Parse Session Data (Optional but useful) ---
        let sessionData;
        try {
            sessionData = JSON.parse(sessionDataJson);
            // Basic validation of expected session data format
            if (!sessionData || typeof sessionData.email !== 'string') {
                throw new Error("Invalid session data format stored in SESSION_ID.");
            }
            console.log(`generate-access-token: Valid session found for user ${sessionData.email}.`);
        } catch (parseError) {
            console.error(`generate-access-token: Critical error parsing session data for token ${sessionToken.substring(0, 8)}***. Data: ${sessionDataJson}`, parseError);
            // This indicates a potential server-side issue with stored data.
            return new Response(JSON.stringify({ error: 'Internal server error processing session' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- Step 3: Generate the Short-Lived Access Token ---
        const accessToken = generateTokenUUID();
        console.log(`generate-access-token: Issuing new access token '${accessToken.substring(0, 8)}***' for user ${sessionData.email}.`);

        // --- Step 4: Store the Access Token Temporarily ---
        // Store the token in the ACCESS_TOKENS KV namespace.
        // The value can be simple (like 'true' or 'valid') or include minimal user info
        // if needed by the middleware or protected endpoint (like the email).
        // Using the email allows potential verification later, but keep it minimal.
        const accessTokenData = JSON.stringify({
            email: sessionData.email,
            issuedAt: Date.now() // Optional: store issuance time
        });

        await ACCESS_TOKENS.put(accessToken, accessTokenData, {
            expirationTtl: ACCESS_TOKEN_TTL_SECONDS // Use the short TTL
        });
        console.log(`generate-access-token: Stored access token in ACCESS_TOKENS KV with TTL ${ACCESS_TOKEN_TTL_SECONDS}s.`);

        // --- Step 5: Set the Access Token Cookie ---
        const responseHeaders = new Headers();
        responseHeaders.append('Content-Type', 'application/json');
        responseHeaders.append(
            'Set-Cookie',
            `access_token=${accessToken}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${ACCESS_TOKEN_TTL_SECONDS}`
            // Note: Max-Age should match the KV TTL for consistency.
        );

        // --- Step 6: Return Success Response ---
        return new Response(JSON.stringify({
            message: 'Access token generated successfully.',
            // Optionally include the expiry time if the frontend needs it
            // expires_in: ACCESS_TOKEN_TTL_SECONDS
        }), {
            status: 200, // OK
            headers: responseHeaders
        });

    } catch (error) {
        // Catch-all for unexpected errors during the process
        console.error('generate-access-token: Unexpected error:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * Main request handler for the function. Routes requests based on method.
 * Handles OPTIONS requests for CORS preflight.
 * @param {EventContext<Env, Params, Data>} context - The function context.
 */
export async function onRequest(context) {
    // Handle POST requests using the main logic
    if (context.request.method === "POST") {
        return await onRequestPost(context);
    }

    // Handle OPTIONS requests for CORS preflight checks
    // Necessary if your frontend calls this API via fetch/XHR from a different origin (even different subdomains usually)
    if (context.request.method === "OPTIONS") {
        // Define allowed origins, methods, headers for CORS
        // Adjust '*' for production environments to your specific frontend domain for better security
        return new Response(null, {
            status: 204, // No Content
            headers: {
                "Access-Control-Allow-Origin": "*", // Or "https://your-frontend-domain.com"
                "Access-Control-Allow-Methods": "POST, OPTIONS", // Only POST is implemented here
                "Access-Control-Allow-Headers": "Content-Type, Authorization", // Specify allowed headers
                "Access-Control-Allow-Credentials": "true", // Important for cookies to be sent/received
                "Access-Control-Max-Age": "86400" // Cache preflight response for 1 day
            }
        });
    }

    // Reject other methods (GET, PUT, DELETE, etc.)
    return new Response('Method Not Allowed', {
        status: 405,
        headers: { 'Allow': 'POST, OPTIONS' } // Indicate allowed methods
    });
}
