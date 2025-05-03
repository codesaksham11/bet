// /functions/api/verify-session.js

// Helper function to parse cookies
function getCookie(request, name) {
    let result = null;
    const cookieString = request.headers.get('Cookie');
    if (cookieString) {
        const cookies = cookieString.split(';');
        cookies.forEach(cookie => {
            // Basic split, handles potential spaces
            const parts = cookie.split('=');
            const cookieName = parts.shift()?.trim();
            const cookieValue = parts.join('=').trim(); // Handle potential '=' in value
            if (cookieName === name) {
                result = cookieValue;
            }
        });
    }
    return result;
}

export async function onRequest(context) {
    const { request, env } = context;

    // KV bindings - Only needs SESSION_ID
    const SESSION_ID = env.SESSION_ID;

    // Check binding
     if (!SESSION_ID) {
        console.error("Missing KV Binding! Ensure SESSION_ID is bound.");
        return new Response(JSON.stringify({ loggedIn: false, error: 'Server configuration error' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }

    // Only handle GET requests for session verification
    if (request.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    console.log("Verify session request received.");

    try {
        // 1. Get the session token from the cookie
        const sessionToken = getCookie(request, 'session_token');

        if (!sessionToken) {
            console.log("Verify session: No session token cookie found.");
            // No token, user is not logged in
            return new Response(JSON.stringify({ loggedIn: false }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            });
        }

        // 2. Look up the session token in SESSION_ID KV
        const sessionDataJson = await SESSION_ID.get(sessionToken);

        if (!sessionDataJson) {
            console.log(`Verify session: Token ${sessionToken.substring(0, 8)}*** not found in SESSION_ID (expired or invalid).`);
            // Token exists in cookie but is not valid in KV
             return new Response(JSON.stringify({ loggedIn: false }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            });
        }

        // 3. Parse session data
        let sessionData;
        try {
             sessionData = JSON.parse(sessionDataJson);
             // Expecting format: {"email": "user_email", "name": "User Name"}
             if (!sessionData || typeof sessionData.email !== 'string' || typeof sessionData.name !== 'string') {
                 throw new Error("Invalid session data format in SESSION_ID KV.");
             }
        } catch(e) {
            console.error(`Verify session: Failed to parse session data for token ${sessionToken.substring(0, 8)}***. Data: ${sessionDataJson}`, e);
             // Delete potentially corrupted session data? Maybe not here, just treat as logged out.
             return new Response(JSON.stringify({ loggedIn: false }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            });
        }

        const { email, name } = sessionData;

        // 4. If all checks pass, return loggedIn: true with user details
        console.log(`Verify session: Valid session found for ${email} (Name: ${name}).`);
        return new Response(JSON.stringify({
            loggedIn: true,
            email: email,
            name: name
        }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in /api/verify-session:', error);
        // Return logged out state in case of any server error
        return new Response(JSON.stringify({ loggedIn: false, error: 'Internal Server Error' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
}
