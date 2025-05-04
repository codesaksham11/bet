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

        // Basic presence and type checks
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
            // Return a generic error message for security
            return new Response(JSON.stringify({ error: 'Invalid email or password.' }), {
                status: 401, // Unauthorized
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- Step 4: Parse Stored User Data & Verify Password ---
        let storedUserData;
        try {
            storedUserData = JSON.parse(storedUserDataJson);
            // ** SECURITY WARNING ** : This checks plain text passwords!
            // You SHOULD store password hashes (e.g., using Argon2, bcrypt)
            // and compare the hash of the submitted password with the stored hash.
            if (!storedUserData || typeof storedUserData.password !== 'string') {
                 throw new Error("Invalid stored user data format. Expected object with 'password' string.");
            }
        } catch (parseError) {
            console.error(`${functionName} CRITICAL ERROR: Failed to parse stored user data for email ${trimmedEmail}. Data: ${storedUserDataJson}`, parseError);
            // Don't reveal internal details to the client
            return new Response(JSON.stringify({ error: 'An internal error occurred during login.' }), {
                status: 500, headers: { 'Content-Type': 'application/json' }
            });
        }

        const storedPassword = storedUserData.password;

        // ** SECURITY WARNING **: Plain text password comparison. HIGHLY INSECURE.
        if (submittedPassword !== storedPassword) {
            console.log(`${functionName} Login failed: Password mismatch for email ${trimmedEmail}`);
            // Return generic error
            return new Response(JSON.stringify({ error: 'Invalid email or password.' }), {
                status: 401, // Unauthorized
                headers: { 'Content-Type': 'application/json' }
            });
        }
        // ** END SECURITY WARNING **

        console.log(`${functionName} Password verified for ${trimmedEmail}.`);

        // --- Step 5: Session Conflict Handling ---
        const existingSessionTokenJson = await SESSION_MAP.get(trimmedEmail);
        if (existingSessionTokenJson) {
            console.log(`${functionName} Existing session found for email: ${trimmedEmail}.`);

            if (!forceLogin) {
                console.log(`${functionName} Conflict: Returning 409 as forceLogin is false.`);
                // Send a specific response so the frontend can ask the user
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
                let oldSessionToken = null;
                try {
                    // Assume the token stored in SESSION_MAP might be JSON stringified or raw
                    try { oldSessionToken = JSON.parse(existingSessionTokenJson); } catch { oldSessionToken = existingSessionTokenJson; }

                    if (oldSessionToken && typeof oldSessionToken === 'string') {
                        await SESSION_ID.delete(oldSessionToken);
                        console.log(`${functionName} Deleted old session data from SESSION_ID (Token: ${oldSessionToken.substring(0,8)}...).`);
                    } else {
                         console.warn(`${functionName} Could not parse or invalid old session token found in SESSION_MAP for ${trimmedEmail}. Proceeding without deleting from SESSION_ID.`);
                    }
                } catch (deleteError) {
                    // Log the error but proceed - failing to delete old session shouldn't block login
                    console.error(`${functionName} Error deleting old session from SESSION_ID for ${trimmedEmail} (Token: ${oldSessionToken ? oldSessionToken.substring(0,8)+'...' : 'unknown'}).`, deleteError);
                }

                // Always delete the mapping regardless of SESSION_ID deletion success
                try {
                    await SESSION_MAP.delete(trimmedEmail);
                    console.log(`${functionName} Deleted old session mapping from SESSION_MAP for ${trimmedEmail}.`);
                } catch (mapDeleteError) {
                     console.error(`${functionName} Error deleting old mapping from SESSION_MAP for ${trimmedEmail}.`, mapDeleteError);
                     // Still proceed with login if possible
                }
            }
        }

        // --- Step 6: Create New Session ---
        const newSessionToken = generateSessionToken();
        const sessionData = {
            email: trimmedEmail,
            name: trimmedName, // Use the name provided in *this* login request
            loggedInAt: Date.now()
        };
        const sessionDataJson = JSON.stringify(sessionData);
        // Store the token itself (JSON stringified for safety) in the map
        const sessionMapValue = JSON.stringify(newSessionToken);

        try {
            await SESSION_ID.put(newSessionToken, sessionDataJson, { expirationTtl: SESSION_TTL_SECONDS });
            console.log(`${functionName} Stored new session data in SESSION_ID (Token: ${newSessionToken.substring(0,8)}...) with TTL ${SESSION_TTL_SECONDS}s.`);

            await SESSION_MAP.put(trimmedEmail, sessionMapValue, { expirationTtl: SESSION_TTL_SECONDS });
            console.log(`${functionName} Stored new session mapping in SESSION_MAP for ${trimmedEmail}.`);
        } catch (kvPutError) {
             console.error(`${functionName} CRITICAL ERROR: Failed to store session data in KV. Email: ${trimmedEmail}`, kvPutError);
             // Attempt to clean up if one put failed
             try { await SESSION_ID.delete(newSessionToken); } catch {}
             try { await SESSION_MAP.delete(trimmedEmail); } catch {}
             return new Response(JSON.stringify({ error: 'Failed to create session. Please try again.' }), {
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
        console.error(`${functionName} UNEXPECTED ERROR in login handler:`, error);
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
        // Using '*' is okay for development but insecure for production.
        "Access-Control-Allow-Origin": "*", // Or "https://your-frontend-domain.com"
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
