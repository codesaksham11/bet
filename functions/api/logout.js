// /functions/api/logout.js

// Helper function to parse cookies (same as before)
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

export async function onRequestPost(context) {
    // Handles only POST requests.
    const { request, env } = context;

    // KV Bindings - Using agreed names
    const SESSION_ID = env.SESSION_ID;
    const SESSION_MAP = env.SESSION_MAP;

    // Check if necessary bindings are present
    if (!SESSION_ID || !SESSION_MAP) {
        console.error("Missing KV Bindings! Ensure SESSION_ID and SESSION_MAP are bound.");
        // Attempt to clear the cookie even if server config is wrong
        const headers = new Headers({ 'Content-Type': 'application/json' });
        headers.append('Set-Cookie', `session_token=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`); // Expire cookie
        return new Response(JSON.stringify({ error: 'Server configuration error during logout' }), { status: 500, headers: headers });
    }

    let userEmail = null; // Variable to store the email if found

    try {
        console.log("Logout request received.");
        // 1. Get the session token from the cookie
        const sessionToken = getCookie(request, 'session_token');

        // 2. If a token exists, attempt to retrieve session data & delete from KV stores
        if (sessionToken) {
            console.log(`Logout initiated for session token ${sessionToken.substring(0,8)}***`);
            // A. Get session data (specifically the email) BEFORE deleting the session
            const sessionDataJson = await SESSION_ID.get(sessionToken);
            if (sessionDataJson) {
                try {
                    const sessionData = JSON.parse(sessionDataJson);
                    // Check if email exists in the session data
                    if (sessionData && sessionData.email) {
                        userEmail = sessionData.email;
                        console.log(`Session data found for token, associated email: ${userEmail}`);

                        // B. Check if the token in SESSION_MAP matches the current token before deleting
                        const activeTokenJson = await SESSION_MAP.get(userEmail);
                        if (activeTokenJson) {
                            try {
                                // Assume token stored in map is a JSON string
                                if (activeTokenJson.startsWith('"')) {
                                     const activeToken = JSON.parse(activeTokenJson);
                                     if (activeToken === sessionToken) {
                                        await SESSION_MAP.delete(userEmail);
                                        console.log(`Deleted session mapping from SESSION_MAP for email: ${userEmail}`);
                                     } else {
                                         console.log(`Token mismatch during logout: Current=${sessionToken.substring(0,8)}***, Active in map=${activeToken.substring(0,8)}***. Not deleting map entry.`);
                                     }
                                } else {
                                    // Handle potential non-JSON stored token in map
                                    if (activeTokenJson === sessionToken) {
                                        await SESSION_MAP.delete(userEmail);
                                        console.log(`Deleted session mapping (non-JSON format) from SESSION_MAP for email: ${userEmail}`);
                                    } else {
                                        console.log(`Token mismatch during logout (non-JSON): Current=${sessionToken.substring(0,8)}***, Active in map=${activeTokenJson.substring(0,8)}***. Not deleting map entry.`);
                                    }
                                }

                            } catch (parseError) {
                                console.error(`Failed to parse active token for email ${userEmail} from SESSION_MAP:`, parseError);
                                // Consider deleting the map entry anyway if parsing fails? Depends on desired behavior.
                                // Let's delete it to clean up potentially bad entries.
                                await SESSION_MAP.delete(userEmail);
                                console.warn(`Deleted potentially corrupt session mapping from SESSION_MAP for email: ${userEmail} due to parse error.`);
                            }
                        } else {
                            console.log(`No active session found in SESSION_MAP for email: ${userEmail}`);
                        }
                    } else {
                        console.warn(`Session data found for token ${sessionToken.substring(0,8)}*** but email is missing.`);
                    }
                } catch (parseError) {
                    console.error(`Failed to parse session data for token ${sessionToken.substring(0,8)}*** during logout:`, parseError);
                    // Proceed with deleting the token from SESSION_ID anyway
                }
            } else {
                console.log(`Logout requested for token ${sessionToken.substring(0,8)}***, but session data not found in SESSION_ID (likely expired or already logged out).`);
            }

            // C. Always attempt to delete the session from SESSION_ID
            await SESSION_ID.delete(sessionToken);
            console.log(`Attempted delete of session token from SESSION_ID: ${sessionToken.substring(0,8)}***`);
        } else {
            console.log('Logout endpoint called, but no session token cookie found.');
        }

        // 3. Prepare response headers to clear the cookie on the client
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        // Set Max-Age to 0 to expire the cookie immediately
        headers.append(
            'Set-Cookie',
            `session_token=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`
        );

        // 4. Send response indicating successful logout process
        console.log("Logout process completed.");
        return new Response(JSON.stringify({ message: 'Logout successful' }), {
            status: 200,
            headers: headers
        });

    } catch (error) {
        console.error('Error in /api/logout function:', error);
        // Even if KV delete fails, we should still try to clear the cookie
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        headers.append('Set-Cookie', `session_token=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`);
        return new Response(JSON.stringify({ error: 'Internal Server Error during logout' }), {
            status: 500,
            headers: headers // Still include cookie clearing header
        });
    }
}

// Optional: Catch-all for non-POST requests
export async function onRequest(context) {
  if (context.request.method === "POST") {
    return await onRequestPost(context);
  }
    // Handle OPTIONS for CORS preflight
    if (context.request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*", // Adjust
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age": "86400"
            }
        });
    }
  return new Response('Method Not Allowed', { status: 405 });
}
