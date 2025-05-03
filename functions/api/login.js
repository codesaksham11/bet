// /functions/api/login.js

function generateSessionToken() {
    return crypto.randomUUID();
}

export async function onRequestPost(context) {
    const { request, env } = context;

    const USER_DATA = env.USER_DATA;
    const SESSION_ID = env.SESSION_ID;
    const SESSION_MAP = env.SESSION_MAP;

    if (!USER_DATA || !SESSION_ID || !SESSION_MAP) {
        console.error("Missing KV Bindings!");
        return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const SESSION_TTL_SECONDS = 3600; // 1 hour

    try {
        console.log("Starting login request processing");
        let userDataInput;
        try {
            userDataInput = await request.json();
        } catch (error) {
            console.error("JSON parsing error:", error.message);
            return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // Expecting name, email, password, optional forceLogin
        const { name, email, password, forceLogin = false } = userDataInput;
        console.log(`Login attempt: Email=${email}, Name=${name}, forceLogin=${forceLogin}`); // Don't log password

        // --- Input Validation ---
        if (!name || typeof name !== 'string' || name.trim() === '' || // Check name
            !email || typeof email !== 'string' || !email.includes('@') ||
            !password || typeof password !== 'string' || password.trim() === '') {
            console.log("Input validation failed (missing name, email, or password)");
            return new Response(JSON.stringify({ error: 'Missing or invalid name, email, or password' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const trimmedName = name.trim(); // Use the name from the request
        const trimmedEmail = email.trim().toLowerCase();
        const submittedPassword = password;

        // --- Look up user in USER_DATA using Email ---
        const storedUserDataJson = await USER_DATA.get(trimmedEmail);
        if (!storedUserDataJson) {
            console.log(`Login attempt failed: Email not found - ${trimmedEmail}`);
            return new Response(JSON.stringify({ error: 'Invalid Email or Password' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }

        // --- Parse stored user data and verify password ---
        let storedUserData;
        try {
            storedUserData = JSON.parse(storedUserDataJson);
            // Expecting format: {"password": "plain_text_password"} - NAME IS NO LONGER STORED HERE
            if (!storedUserData || typeof storedUserData.password !== 'string') {
                 throw new Error("Invalid stored user data format. Expected {password: string}.");
            }
        } catch (parseError) {
            console.error(`Failed to parse user data or invalid format for email ${trimmedEmail}:`, parseError);
            return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }

        const storedPassword = storedUserData.password;

        // --- PLAIN TEXT PASSWORD CHECK ---
        if (submittedPassword !== storedPassword) {
            console.log(`Login attempt failed: Password mismatch for email ${trimmedEmail}`);
            return new Response(JSON.stringify({ error: 'Invalid Email or Password' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        // --- END PLAIN TEXT CHECK ---

        console.log(`Password verified for ${trimmedEmail}. Checking sessions.`);

        // --- Session Handling (Checks SESSION_MAP, potentially deletes old session) ---
        const existingSessionTokenJson = await SESSION_MAP.get(trimmedEmail);
        if (existingSessionTokenJson) {
            console.log(`Existing session found for email: ${trimmedEmail}`);
            if (!forceLogin) {
                console.log(`Returning 409 Conflict for email: ${trimmedEmail}`);
                return new Response(JSON.stringify({ conflict: true, message: 'This email is already logged in...' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
            } else {
                // Force login: Invalidate old session
                console.log(`Force login requested for email: ${trimmedEmail}. Invalidating previous session.`);
                 try {
                    if (existingSessionTokenJson.startsWith('"')) {
                        const existingSessionToken = JSON.parse(existingSessionTokenJson);
                        if (existingSessionToken) await SESSION_ID.delete(existingSessionToken);
                    } else {
                         await SESSION_ID.delete(existingSessionTokenJson); // Handle potential non-JSON format
                    }
                     console.log(`Deleted previous session token from SESSION_ID (if existed)`);
                 } catch (deleteError) {
                     console.error(`Error deleting previous session from SESSION_ID for ${trimmedEmail}:`, deleteError);
                 }
                 await SESSION_MAP.delete(trimmedEmail);
                 console.log(`Deleted previous session mapping from SESSION_MAP for ${trimmedEmail}`);
            }
        }

        // --- Create New Session ---
        const newSessionToken = generateSessionToken();
        // SESSION DATA NOW USES THE NAME FROM THE *REQUEST*
        const sessionData = {
            email: trimmedEmail,
            name: trimmedName // Use the name provided in this specific login
        };

        await SESSION_ID.put(newSessionToken, JSON.stringify(sessionData), { expirationTtl: SESSION_TTL_SECONDS });
        await SESSION_MAP.put(trimmedEmail, JSON.stringify(newSessionToken), { expirationTtl: SESSION_TTL_SECONDS });
        console.log(`Stored new session mapping for ${trimmedEmail}: ${newSessionToken.substring(0, 8)}***`);

        // --- Prepare Response ---
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        headers.append('Set-Cookie', `session_token=${newSessionToken}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`);

        console.log(`Login successful for email ${trimmedEmail} as Name: ${trimmedName} (Forced: ${forceLogin})`);
        return new Response(JSON.stringify({
            message: 'Login successful',
            status: 'success',
            name: trimmedName // Return the name used for this session
        }), { status: 200, headers: headers });

    } catch (error) {
        console.error('Error in /api/login function:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

// onRequest function (handling POST and OPTIONS) remains the same as previous version
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
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400"
      }
    });
  }
  return new Response('Method Not Allowed', { status: 405 });
} 
