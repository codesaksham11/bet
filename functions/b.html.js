// /functions/b.html.js (Modified to check session_id)

// Assume getCookie and createAccessDeniedResponse functions remain the same

/**
 * Middleware function for /b.html.
 * Verifies the 'session_id' cookie before allowing access.
 * @param {EventContext<Env, any, any>} context - The function context.
 */
export async function onRequest(context) {
    console.log("!!!!!!!!!!!! /functions/b.html.js MIDDLEWARE IS RUNNING (Session Check Version) !!!!!!!!!!!!"); // Add logging

    const { request, env, next } = context;
    const functionName = "[b.html middleware - Session Check]";

    if (request.method !== 'GET') {
        console.log(`${functionName} Passing through non-GET request (${request.method}).`);
        return next();
    }

    console.log(`${functionName} Intercepting GET request for /b.html.`);

    // --- KV Bindings ---
    // Needs SESSIONS KV to verify the main session
    const SESSIONS = env.SESSIONS; // *** IMPORTANT: Make sure 'SESSIONS' KV is bound to this function ***

    if (!SESSIONS) {
        console.error(`${functionName} CRITICAL ERROR: Missing KV Binding! SESSIONS is required.`);
        return createAccessDeniedResponse(
            'सर्भर त्रुटि',
            'पृष्ठ लोड गर्न आवश्यक कन्फिगरेसन मिलेन। कृपया पछि प्रयास गर्नुहोस्।'
        );
    }

    // --- Step 1: Check for the session_id cookie ---
    const sessionId = getCookie(request, 'session_id'); // Use your actual session cookie name

    if (!sessionId) {
        console.log(`${functionName} Access denied: 'session_id' cookie missing.`);
        // Optionally, clear the invalid access_token cookie if it exists
        // const clearAccessTokenCookie = 'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax';
        const response = createAccessDeniedResponse(
            'पहुँच अस्वीकृत',
            'यो पृष्ठ प्रयोग गर्न तपाईं लगइन हुनु पर्छ।'
        );
        // response.headers.append('Set-Cookie', clearAccessTokenCookie); // Example of clearing
        return response;
    }

    console.log(`${functionName} Found 'session_id': ${sessionId.substring(0,8)}... Verifying.`);

    // --- Step 2: Verify the session ID against SESSIONS KV ---
    try {
        const sessionData = await SESSIONS.get(sessionId);

        if (!sessionData) {
            console.log(`${functionName} Access denied: Session ID ${sessionId.substring(0,8)}... not found in KV (invalid or expired).`);
             // Optionally, clear the invalid session_id cookie and access_token cookie
            const response = createAccessDeniedResponse(
                'पहुँच अस्वीकृत',
                'तपाईंको सत्र समाप्त भयो वा अमान्य छ। कृपया फेरि लगइन गर्नुहोस्।'
            );
             // Add Set-Cookie headers here if desired
            return response;
        }

        // Optional: Could parse sessionData if needed (e.g., logging user email)
        console.log(`${functionName} Session valid for ${sessionId.substring(0,8)}... Access granted.`);

        // --- Step 3: Access Granted - Proceed to serve b.html ---
        // Pass control to the default static asset handler
        return next();

    } catch (error) {
        console.error(`${functionName} UNEXPECTED ERROR during session verification:`, error);
        return createAccessDeniedResponse(
            'आन्तरिक त्रुटि',
            'सत्र प्रमाणीकरण गर्दा त्रुटि भयो। कृपया पछि प्रयास गर्नुहोस्।'
        );
    }
}
