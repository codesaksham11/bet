// /functions/_middleware.js

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

// Define the paths that require authentication
const PROTECTED_PATHS = [
    '/b.html'
    // Add other paths here if needed, e.g., '/api/arbitrage-data'
];

export async function onRequest(context) {
    const { request, next, env } = context; // `next` proceeds to the requested resource or next middleware
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. Check if the requested path is in our protected list
    const requiresAuth = PROTECTED_PATHS.some(path => pathname === path || pathname.startsWith(path + '/')); // Handle trailing slashes if needed

    if (!requiresAuth) {
        // Not a protected path, allow access directly
        // console.log(`Middleware: Path ${pathname} is not protected. Passing through.`);
        return await next();
    }

    // --- Protection Logic for Protected Paths ---
    console.log(`Middleware: Checking access for protected path: ${pathname}`);

    // KV Binding - Only needs SESSION_ID to verify token existence
    const SESSION_ID = env.SESSION_ID;
    if (!SESSION_ID) {
         console.error("Middleware: Missing KV Binding! Ensure SESSION_ID is bound.");
         // Return a generic server error if middleware config is broken
         return new Response('Server configuration error', { status: 500 });
    }

    // 2. Get the session token cookie
    const sessionToken = getCookie(request, 'session_token');

    if (!sessionToken) {
        console.log(`Middleware: Access denied to ${pathname}: Missing session_token cookie.`);
        // Redirect to the login page (index.html)
        const loginUrl = new URL('/', request.url); // Assumes login is at root '/'
        return Response.redirect(loginUrl.toString(), 302); // 302 Found - temporary redirect
    }

    // 3. Validate the session token by checking its existence in SESSION_ID KV
    try {
        const sessionDataJson = await SESSION_ID.get(sessionToken);

        if (!sessionDataJson) {
            // Token exists in cookie but not in KV (invalid or expired)
            console.log(`Middleware: Access denied to ${pathname}: Invalid/expired session token ${sessionToken.substring(0,8)}***.`);
            // Redirect to login, maybe with an error message? (Simpler to just redirect)
            const loginUrl = new URL('/', request.url);
             // Optionally: Clear the invalid cookie? Not strictly needed, but can be cleaner.
             // const headers = new Headers({ Location: loginUrl.toString() });
             // headers.append('Set-Cookie', `session_token=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`);
             // return new Response(null, { status: 302, headers: headers });
            return Response.redirect(loginUrl.toString(), 302);
        }

        // --- Session Token is Valid ---
        console.log(`Middleware: Access granted to ${pathname} for session token ${sessionToken.substring(0,8)}***.`);

        // Optional: Add verified user info to context for downstream functions/pages if needed
         try {
             const sessionData = JSON.parse(sessionDataJson);
             context.data = context.data || {}; // Ensure context.data exists
             context.data.user = { email: sessionData.email, name: sessionData.name };
             console.log(`Middleware: Added user context: ${sessionData.email}`);
         } catch (e) {
             console.error("Middleware: Error parsing session data after validation:", e);
             // Should not happen if get succeeded, but handle defensively
         }


        // 4. Allow the request to proceed to the target resource (e.g., b.html)
        return await next();

    } catch (error) {
        // Handle potential errors during KV lookup
        console.error(`Middleware: Error during KV lookup for token ${sessionToken?.substring(0,8)}*** -`, error);
        // Return a generic server error
        return new Response('Error verifying session', { status: 500 });
    }
}
