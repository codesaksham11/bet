// /functions/api/login.js

/**
 * Generates a secure random UUID for session tokens using the Web Crypto API.
 * @returns {string} A UUID string.
 */
function generateSessionToken() {
    // Cloudflare Workers provide the global crypto object
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    } else {
        // Fallback (Highly unlikely in modern CF Workers, but good practice)
        console.error("login.js: crypto.randomUUID not available. Using Math.random fallback (INSECURE).");
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

/**
 * Handles POST requests for user login.
 * Verifies credentials, manages sessions, and sets an HttpOnly session cookie.
 * @param {EventContext<Env, any, any>} context - The function context.
 */
export async function onRequestPost(context) {
    const { request, env } = context;
    const functionName = "[login]"; // For logging clarity

    console.log(`${functionName} Received request.`);

    // --- KV Bindings ---
    // These MUST be configured in your wrangler.toml or Cloudflare dashboard
    const USER_DATA = env.USER_DATA;
    const SESSION_ID = env.SESSION_ID;
    const SESSION_MAP = env.SESSION_MAP;

    // --- Check if KV Bindings are present ---
    if (!USER_DATA || !SESSION_ID || !SESSION_MAP) {
        console.error(`${functionName} CRITICAL ERROR: Missing KV Bindings! USER_DATA, SESSION_ID, and SESSION_MAP are required.`);
        return new Response(JSON.stringify({ error: 'Server configuration error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // --- Configuration ---
    const SESSION_TTL_SECONDS = 3600 * 24 * 7; // 7 days (adjust as needed)

    try {
        // --- Step 1: Parse Request Body ---
        let requestBody;
        try {
            requestBody = await request.json();
            console.log(`${functionName} Parsed request body.`);
        } catch (error) {
            console.warn(`${functionName} Failed to parse JSON body:`, error.message);
            return new Response(JSON.stringify({ error: 'Invalid request body. Expected JSON.' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- Step 2: Input Validation ---
        const { name, email, password, forceLogin = false } = requestBody;

        if (
            !name || typeof name !== 'string' || name.trim() === '' ||
            !email || typeof email !== 'string' || !email.includes('@') || // Basic email format check
            !password || typeof password !== 'string' || password.trim() === ''
        ) {
            console.warn(`${functionName} Input validation failed: Missing or invalid name, email, or password.`);
            return new Response(JSON.stringify({ error: 'Missing or invalid name, email, or password.' }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        const trimmedName = name.trim();
        const trimmedEmail = email.trim().toLowerCase(); // Standardize email to lowercase
        const submittedPassword = password; // No trimming on password

        console.log(`${functionName} Attempting login for Email: ${trimmedEmail}, Name: ${trimmedName}, ForceLogin: ${forceLogin}`);

        // --- Step 3: Look up user in USER_DATA KV ---
        const storedUserDataJson = await USER_DATA.get(trimmedEmail);

        if (!storedUserDataJson) {
            console.log(`${functionName} Login failed: Email not found - ${trimmedEmail}`);
            return new Response(JSON.stringify({ error: 'Invalid email or password.' }), {
                status: 401, headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- Step 4: Parse Stored User Data & Verify Password ---
        let storedUserData;
        try {
            storedUserData = JSON.parse(storedUserDataJson);
            // ** >>> SECURITY WARNING <<< **
            // ** Storing and comparing plain text passwords is HIGHLY INSECURE! **
            // ** You MUST replace this with password hashing (e.g., Argon2, bcrypt). **
            // ** 1. When storing/registering: hash the password before USER_DATA.put() **
            // ** 2. When logging in: hash the submittedPassword and compare the HASHES. **
            if (!storedUserData || typeof storedUserData.password !== 'string') {
                 throw new Error("Invalid stored user data format. Expected object with 'password' string.");
            }
        } catch (parseError) {
            console.error(`${functionName} CRITICAL ERROR: Failed to parse stored user data for email ${trimmedEmail}. Data: ${storedUserDataJson}`, parseError);
            return new Response(JSON.stringify({ error: 'An internal error occurred during login.' }), {
                status: 500, headers: { 'Content-Type': 'application/json' }
            });
        }

        const storedPassword = storedUserData.password; // This should be a HASH in a real application

        // ** >>> SECURITY WARNING <<< ** : Plain text password comparison.
        if (submittedPassword !== storedPassword) { // This comparison MUST be done with hashes
            console.log(`${functionName} Login failed: Password mismatch for email ${trimmedEmail}`);
            return new Response(JSON.stringify({ error: 'Invalid email or password.' }), {
                status: 401, headers: { 'Content-Type': 'application/json' }
            });
        }
        // ** >>> END SECURITY WARNING <<< **

        console.log(`${functionName} Password verified for ${trimmedEmail}.`);

        // --- Step 5: Session Conflict Handling (Revised) ---
        // Get the raw value (should be the session token string) from SESSION_MAP
        const existingSessionToken = await SESSION_MAP.get(trimmedEmail);

        // Check if it's a non-empty string (a valid token was found)
        if (existingSessionToken && typeof existingSessionToken === 'string') {
            console.log(`${functionName} Existing session found for email: ${trimmedEmail} (Token: ${existingSessionToken.substring(0,8)}...).`);

            if (!forceLogin) {
                // User hasn't confirmed they want to override the existing session
                console.log(`${functionName} Conflict: Returning 409 as forceLogin is false.`);
                return new Response(JSON.stringify({
                    conflict: true,
                    message: 'This email is already associated with an active session.'
                }), {
                    status: 409, // Conflict
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                // Force login: Invalidate the old session
                console.log(`${functionName} Force login requested. Invalidating previous session for ${trimmedEmail}.`);

                // Delete old session data from SESSION_ID using the retrieved token
                try {
                    await SESSION_ID.delete(existingSessionToken); // Use the raw token string as the key
                    console.log(`${functionName} Deleted old session data from SESSION_ID (Token: ${existingSessionToken.substring(0,8)}...).`);
                } catch (deleteError) {
                    // Log the error but proceed - failing to delete old session shouldn't block the new login
                    console.error(`${functionName} Error deleting old session from SESSION_ID for ${trimmedEmail} (Token: ${existingSessionToken.substring(0,8)}...).`, deleteError);
                }

                // Delete the mapping from SESSION_MAP (always attempt this, even if SESSION_ID delete failed)
                try {
                    await SESSION_MAP.delete(trimmedEmail);
                    console.log(`${functionName} Deleted old session mapping from SESSION_MAP for ${trimmedEmail}.`);
                } catch (mapDeleteError) {
                    console.error(`${functionName} Error deleting old mapping from SESSION_MAP for ${trimmedEmail}.`, mapDeleteError);
                    // Still proceed with login if possible
                }
            }
        } else if (existingSessionToken) {
             // If a value exists in SESSION_MAP but it's not a string, something is wrong.
             // Log a warning and try to delete the map entry anyway to clean up.
             console.warn(`${functionName} Found unexpected non-string value in SESSION_MAP for ${trimmedEmail}. Type: ${typeof existingSessionToken}. Value: ${JSON.stringify(existingSessionToken)}. Attempting cleanup.`);
              try { await SESSION_MAP.delete(trimmedEmail); } catch (e) { console.error(`${functionName} Error cleaning up invalid SESSION_MAP entry for ${trimmedEmail}:`, e); }
        }

        // --- Step 6: Create New Session (Revised) ---
        const newSessionToken = generateSessionToken();
        const sessionData = {
            email: trimmedEmail,
            name: trimmedName, // Use the name provided in *this* login request
            loggedInAt: Date.now()
        };
        const sessionDataJson = JSON.stringify(sessionData);
        // Store the RAW session token string in the map (email -> session_token)
        const sessionMapValue = newSessionToken;

        try {
            // Use Promise.all to perform KV writes concurrently
            await Promise.all([
                SESSION_ID.put(newSessionToken, sessionDataJson, { expirationTtl: SESSION_TTL_SECONDS }),
                SESSION_MAP.put(trimmedEmail, sessionMapValue, { expirationTtl: SESSION_TTL_SECONDS }) // Store raw token string
            ]);

            console.log(`${functionName} Stored new session data in SESSION_ID (Token: ${newSessionToken.substring(0,8)}...) with TTL ${SESSION_TTL_SECONDS}s.`);
            console.log(`${functionName} Stored new session mapping in SESSION_MAP for ${trimmedEmail}.`);

        } catch (kvPutError) {
             console.error(`${functionName} CRITICAL ERROR: Failed to store session data in KV. Email: ${trimmedEmail}`, kvPutError);
             // Attempt to clean up potentially partially created session - don't await these cleanup deletes
             SESSION_ID.delete(newSessionToken).catch(e => console.error(`${functionName} Cleanup Error deleting from SESSION_ID during failed PUT:`, e));
             SESSION_MAP.delete(trimmedEmail).catch(e => console.error(`${functionName} Cleanup Error deleting from SESSION_MAP during failed PUT:`, e));

             // Return 500 error to the client
             return new Response(JSON.stringify({ error: 'Failed to create session due to a server issue. Please try again.' }), {
                status: 500, headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- Step 7: Prepare Response with Cookie ---
        const headers = new Headers();
        headers.append('Content-Type', 'application/json');
        // Set HttpOnly cookie for security (prevents JS access)
        // Secure; ensures it's only sent over HTTPS
        // SameSite=Lax; provides CSRF protection for top-level navigation
        // Max-Age; controls cookie lifetime (matches KV TTL)
        headers.append(
            'Set-Cookie',
            `session_token=${newSessionToken}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`
        );

        console.log(`${functionName} Login successful for ${trimmedEmail} as Name: ${trimmedName}. Setting cookie.`);
        return new Response(JSON.stringify({
            message: 'Login successful',
            status: 'success',
            name: trimmedName // Return the name used for this session
        }), {
            status: 200,
            headers: headers
        });

    } catch (error) {
        // Catch any unexpected errors not handled within specific steps
        console.error(`${functionName} UNEXPECTED ERROR in login handler:`, error);
        // Log the stack trace if available for better debugging
        console.error(error.stack || error.message);
        return new Response(JSON.stringify({ error: 'An unexpected internal server error occurred.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * Main request handler for the function. Routes requests based on method.
 * Handles POST for login and OPTIONS for CORS preflight.
 * @param {EventContext<Env, any, any>} context - The function context.
 */
export async function onRequest(context) {
  const { request } = context;

  if (request.method === "POST") {
    return await onRequestPost(context);
  }

  if (request.method === "OPTIONS") {
    // Handle CORS preflight requests
    return new Response(null, {
      status: 204, // No Content
      headers: {
        // IMPORTANT: Adjust Allow-Origin in production! Use your actual frontend domain.
        "Access-Control-Allow-Origin": "*", // Or "https://your-frontend-domain.com" // TODO: Change in production
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type", // Allow 'Content-Type' header
        "Access-Control-Allow-Credentials": "true", // Important for cookies
        "Access-Control-Max-Age": "86400", // Cache preflight response for 1 day
      }
    });
  }

  // Reject other methods
  return new Response('Method Not Allowed', {
      status: 405,
      headers: { 'Allow': 'POST, OPTIONS' }
    });
}
