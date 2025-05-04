// /functions/api/verify-session.js

/**
 * Helper function to parse a specific cookie from the Request headers.
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
            // Handle potential leading spaces and decode URI component for cookie name
            const cookieName = decodeURIComponent(parts.shift()?.trim() || '');
            if (cookieName === name) {
                // Decode URI component for cookie value
                result = decodeURIComponent(parts.join('=').trim());
            }
        });
    }
    return result;
}

/**
 * Handles GET requests to verify the validity of the user's session_token cookie.
 * Returns user information if the session is valid.
 * @param {EventContext<Env, any, any>} context - The function context.
 */
export async function onRequestGet(context) {
    const { request, env } = context;
    const functionName = "[verify-session]"; // For logging clarity

    console.log(`${functionName} Received request.`);

    // --- KV Binding ---
    // This function ONLY needs the SESSION_ID KV namespace
    const SESSION_ID = env.SESSION_ID;

    // --- Check if KV Binding is present ---
    if (!SESSION_ID) {
        console.error(`${functionName} CRITICAL ERROR: Missing KV Binding! SESSION_ID is required.`);
        // Return a generic error but indicate configuration issue on server side
        return new Response(JSON.stringify({ loggedIn: false, error: 'Server configuration error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        // --- Step 1: Extract session_token cookie ---
        const sessionToken = getCookie(request, 'session_token');

        if (!sessionToken) {
            console.log(`${functionName} No 'session_token' cookie found. User is not logged in.`);
            // No token means not logged in. This is a normal, expected state.
            return new Response(JSON.stringify({ loggedIn: false }), {
                status: 200, // OK status, just indicating logged out state
                headers: { 'Content-Type': 'application/json' }
            });
        }

        console.log(`${functionName} Found 'session_token' cookie: ${sessionToken.substring(0,8)}...`);

        // --- Step 2: Look up session token in SESSION_ID KV ---
        const sessionDataJson = await SESSION_ID.get(sessionToken);

        if (!sessionDataJson) {
            console.log(`${functionName} Session token ${sessionToken.substring(0,8)}... not found in SESSION_ID (invalid or expired).`);
            // Token exists in cookie but is not valid in KV (or expired). Treat as logged out.
            // We can also send headers to clear the invalid cookie from the browser.
            const clearHeaders = new Headers({ 'Content-Type': 'application/json' });
            clearHeaders.append('Set-Cookie', `session_token=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`); // Expires immediately

            return new Response(JSON.stringify({ loggedIn: false, reason: 'invalid_or_expired_token' }), {
                status: 200, // Still OK, just indicating logged out
                headers: clearHeaders
            });
        }

        console.log(`${functionName} Session token ${sessionToken.substring(0,8)}... found in SESSION_ID.`);

        // --- Step 3: Parse session data ---
        let sessionData;
        try {
             sessionData = JSON.parse(sessionDataJson);
             // Validate the expected structure (adjust based on what you store in login.js)
             if (!sessionData || typeof sessionData.email !== 'string' || typeof sessionData.name !== 'string') {
                 throw new Error("Invalid session data format in SESSION_ID KV. Expected {email, name}.");
             }
             console.log(`${functionName} Successfully parsed session data for ${sessionData.email}.`);
        } catch (parseError) {
            console.error(`${functionName} Failed to parse session data for token ${sessionToken.substring(0, 8)}***. Data: ${sessionDataJson}`, parseError);
             // If data is corrupted, treat the user as logged out and clear the bad cookie.
             const clearHeaders = new Headers({ 'Content-Type': 'application/json' });
             clearHeaders.append('Set-Cookie', `session_token=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`);

             // Don't delete the potentially corrupted KV entry here automatically,
             // but log it for investigation.
             return new Response(JSON.stringify({ loggedIn: false, error: 'Corrupted session data', reason: 'corrupted_data' }), {
                status: 200, // OK status, but indicates an issue needs fixing
                headers: clearHeaders
            });
        }

        // --- Step 4: Session is valid - Return user details ---
        console.log(`${functionName} Valid session verified for Email: ${sessionData.email}, Name: ${sessionData.name}.`);
        return new Response(JSON.stringify({
            loggedIn: true,
            email: sessionData.email,
            name: sessionData.name
            // Optionally add other non-sensitive data from sessionData if needed
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error(`${functionName} UNEXPECTED ERROR in verify-session handler:`, error);
        // Return logged out state in case of any unexpected server error
        return new Response(JSON.stringify({ loggedIn: false, error: 'An unexpected internal server error occurred.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}


/**
 * Main request handler. Routes based on method.
 * Handles GET for verification and OPTIONS for CORS preflight.
 * @param {EventContext<Env, any, any>} context - The function context.
 */
export async function onRequest(context) {
    const { request } = context;

    if (request.method === "GET") {
        return await onRequestGet(context);
    }

    if (request.method === "OPTIONS") {
        // Handle CORS preflight requests - needed if frontend origin differs
        return new Response(null, {
            status: 204,
            headers: {
                // IMPORTANT: Adjust Allow-Origin in production!
                "Access-Control-Allow-Origin": "*", // Or "https://your-frontend-domain.com"
                "Access-Control-Allow-Methods": "GET, OPTIONS", // Only GET is used here
                "Access-Control-Allow-Headers": "Content-Type", // Allow common headers
                 "Access-Control-Allow-Credentials": "true", // Necessary for cookies
                "Access-Control-Max-Age": "86400",
            }
        });
    }

    // Reject other methods
    return new Response('Method Not Allowed', {
        status: 405,
        headers: { 'Allow': 'GET, OPTIONS' }
    });
}
