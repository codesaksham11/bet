// /functions/b.html/_middleware.js

/**
 * Helper function to parse a specific cookie from the Request headers.
 */
function getCookie(request, name) {
    let result = null;
    const cookieString = request.headers.get('Cookie');
    if (cookieString) {
        const cookies = cookieString.split(';');
        cookies.forEach(cookie => {
            const parts = cookie.split('=');
            const cookieName = decodeURIComponent(parts.shift()?.trim() || '');
            if (cookieName === name) {
                result = decodeURIComponent(parts.join('=').trim());
            }
        });
    }
    return result;
}

/**
 * Middleware to protect the static /b.html file.
 * Requires a valid, one-time 'access_token' cookie.
 *
 * @param {EventContext<Env, any, { cf: CfProperties }>} context
 */
export async function onRequest(context) {
    const { request, env, next } = context;
    const functionName = "[b.html-middleware]";
    const pathname = new URL(request.url).pathname;

    // Only apply this logic strictly to requests for /b.html
    // This check might be redundant given the file placement, but it's safe.
    if (pathname !== '/b.html') {
        
        return await next(); // Continue to the next step (serving the file or 404)
    }

    console.log(`${functionName} Request received for protected path: ${pathname}`);

    // --- KV Binding ---
    const ACCESS_TOKENS = env.ACCESS_TOKENS;
    if (!ACCESS_TOKENS) {
        console.error(`${functionName} CRITICAL ERROR: Missing KV Binding! ACCESS_TOKENS is required.`);
        // Return an error page instead of JSON for a direct HTML request
        return new Response("Server configuration error. Cannot verify access.", {
            status: 500,
            headers: { 'Content-Type': 'text/plain' }
        });
    }

    // --- Step 1: Get the Access Token from the cookie ---
    const accessToken = getCookie(request, 'access_token');

    // --- What happens if no access token is found? ---
    if (!accessToken) {
        console.log(`${functionName} Access denied to ${pathname}. No 'access_token' cookie found.`);
        // Redirect to login or an "access denied" page. Redirecting to login is common.
        // Replace '/login' with your actual login page URL if different.
        // You could also return a custom 401 HTML page here.
        // return Response.redirect(new URL('/login', request.url).toString(), 302);
         return new Response("Access Denied: An access token is required. Please generate one first.", {
            status: 401, // Unauthorized
            headers: { 'Content-Type': 'text/plain' } // Or text/html for a nicer page
        });
    }

    console.log(`${functionName} Found 'access_token' cookie: ${accessToken.substring(0, 8)}... Attempting verification.`);

    try {
        // --- Step 2: Look up access token in ACCESS_TOKENS KV ---
        const accessTokenDataJson = await ACCESS_TOKENS.get(accessToken);

        // --- What happens if the token is invalid/expired/already used? ---
        if (!accessTokenDataJson) {
            console.log(`${functionName} Access denied to ${pathname}. Access token ${accessToken.substring(0, 8)}*** is invalid, expired, or already used.`);

            // Clear the invalid cookie from the browser
            const clearHeaders = new Headers({ 'Content-Type': 'text/plain' }); // Or text/html
            clearHeaders.append('Set-Cookie', `access_token=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`);

            // Redirect or show an error
            // return Response.redirect(new URL('/login?reason=invalid_token', request.url).toString(), 302);
            return new Response("Access Denied: Your access token is invalid, expired, or has already been used. Please generate a new one.", {
                status: 401, // Unauthorized
                headers: clearHeaders
            });
        }

        console.log(`${functionName} Access token ${accessToken.substring(0, 8)}... verified in ACCESS_TOKENS.`);

        // --- Step 3: Implement One-Time Use - Delete the token ---
        console.log(`${functionName} Deleting used access token ${accessToken.substring(0, 8)}*** from KV for one-time use.`);
        // We use waitUntil to allow the response to proceed while the delete happens in the background.
        context.waitUntil(ACCESS_TOKENS.delete(accessToken));

        // --- Step 4: Access Granted - Proceed to serve the static file ---
        console.log(`${functionName} Access granted to ${pathname}. Allowing static file serving.`);
        // The 'next()' function tells Pages to continue processing the request,
        // which in this case means serving the static /b.html file.
        return await next();

    } catch (error) {
        console.error(`${functionName} UNEXPECTED ERROR during access token verification for ${pathname}:`, error);
        return new Response("An internal server error occurred while verifying access.", {
            status: 500,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}
