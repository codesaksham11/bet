// /functions/_middleware.js

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

// Define the paths that require short-lived access token authentication
// This likely remains the same as before.
const PROTECTED_PATHS = [
    '/b.html'
    // Add other paths that should use the short-lived token here
];

/**
 * Creates the custom HTML error response for authorization failures.
 * (This function remains unchanged from your previous version)
 * @param {Request} request - The original request object to get the base URL.
 * @returns {Response} - An HTML response object indicating authorization is required.
 */
function createAuthErrorResponse(request) {
    const baseUrl = new URL(request.url).origin;
    const htmlBody = `
<!DOCTYPE html>
<html lang="ne">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>पहुँच अस्वीकृत</title> <!-- Title changed slightly -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Noto Sans Devanagari', sans-serif; background-color: #f4f7f6; color: #333; display: flex; justify-content: center; align-items: center; min-height: 100vh; text-align: center; padding: 20px; line-height: 1.8; }
        .container { background-color: #fff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); max-width: 500px; }
        h1 { color: #e74c3c; margin-bottom: 20px; font-size: 1.8em; }
        p { font-size: 1.1em; margin-bottom: 25px; }
        a { display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-weight: 600; transition: background-color 0.3s ease; }
        a:hover { background-color: #0056b3; }
        img.warning-image { max-width: 80px; margin-bottom: 20px; } /* Adjusted image style slightly */
    </style>
</head>
<body>
    <div class="container">
        <!-- Consider a different icon/image for access denied vs. login required -->
        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlN
      zRjM2MiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0iZmVhdGhlciBmZWF0aGVyLXgtb2N0YWdvbiI+PHBvbHlnb24gcG9pbnRzPSI3Ljg2IDIgMTYuMTQgMiAxOS4xNCA3Ljg2IDE5LjE0IDE2LjE0IDE2LjE0IDIyIDcuODYgMjIgNC44NiAxNi4xNCA0Ljg2IDcuODYgNy44NiAyIj48L3BvbHlnb24+PGxpbmUgeDE9IjE1IiB5MT0iOSIgeDI9IjkiIHkyPSIxNSI+PC9saW5lPjxsaW5lIHgxPSI5IiB5MT0iOSIgeDI9IjE1IiB5Mj0iMTUiPjwvbGluZT48L3N2Zz4=" alt="Warning" class="warning-image">
        <h1>पहुँच अस्वीकृत!</h1>
        <p>यो पृष्ठ हेर्न तपाईंको पहुँच मान्य छैन वा समाप्त भएको छ। कृपया फेरि प्रयास गर्न मुख्य पृष्ठमा जानुहोस्।</p> <!-- Message updated -->
        <a href="${baseUrl}/">मुख्य पेजमा फर्कनुहोस्</a>
    </div>
</body>
</html>
`; // Note: Base64 image data truncated for brevity

    return new Response(htmlBody, {
        status: 403, // Forbidden - More appropriate than 401 if they had a token but it's invalid/expired
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}


// --- Middleware Logic ---

/**
 * Middleware function to protect specific paths by validating a short-lived access token.
 * @param {EventContext<Env, Params, Data>} context - The function context.
 */
export async function onRequest(context) {
    const { request, next, env } = context;
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. Check if the requested path needs protection by this middleware
    const requiresAccessTokenAuth = PROTECTED_PATHS.some(path =>
        pathname === path || pathname.startsWith(path + '/')
    );

    if (!requiresAccessTokenAuth) {
        // Path is not protected by this logic, pass to the next handler/function or serve the static asset.
        console.log(`Middleware: Path ${pathname} does not require access token auth. Passing through.`);
        return await next();
    }

    // --- Access Token Protection Logic ---
    console.log(`Middleware: Checking access token for protected path: ${pathname}`);

    // 2. Get the required KV Binding for short-lived tokens
    // *** Ensure ACCESS_TOKENS is bound in your Cloudflare settings ***
    const ACCESS_TOKENS = env.ACCESS_TOKENS;
    if (!ACCESS_TOKENS) {
         console.error("Middleware: Missing KV Binding! Ensure ACCESS_TOKENS is bound.");
         // Return the custom error page for server config issues as well
         return createAuthErrorResponse(request);
    }

    // 3. Get the short-lived access_token cookie from the request
    const accessToken = getCookie(request, 'access_token');

    if (!accessToken) {
        // The required access token cookie is missing entirely.
        console.log(`Middleware: Access denied to ${pathname}: Missing 'access_token' cookie.`);
        // Return custom HTML error page
        return createAuthErrorResponse(request);
    }

    // 4. Validate the access token by checking the ACCESS_TOKENS KV store
    try {
        console.log(`Middleware: Validating access token: ${accessToken.substring(0, 8)}***`);
        // Attempt to retrieve the token's data from KV.
        // If the token exists and hasn't expired according to its TTL, this will return the stored value.
        // If the token does not exist or has expired, this will return null.
        const tokenDataJson = await ACCESS_TOKENS.get(accessToken);

        if (!tokenDataJson) {
            // Token exists in the cookie, but it's not found in the KV store.
            // This means the token is invalid, forged, or has expired.
            console.log(`Middleware: Access denied to ${pathname}: Invalid or expired access token '${accessToken.substring(0, 8)}***'.`);

            // Return custom HTML error page AND clear the invalid cookie
            const errorResponse = createAuthErrorResponse(request);
            const responseHeaders = new Headers(errorResponse.headers); // Copy existing headers (like Content-Type)
            // Add header to clear the bad access_token cookie
            responseHeaders.append('Set-Cookie', `access_token=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`);

            return new Response(errorResponse.body, {
                status: errorResponse.status, // Use the status from createAuthErrorResponse (e.g., 403)
                headers: responseHeaders
            });
        }

        // --- Access Token is Valid ---
        console.log(`Middleware: Access granted to ${pathname} for access token ${accessToken.substring(0, 8)}***.`);

        // Optional: Add user context to `context.data` if you stored useful info in the KV value
        try {
            const tokenData = JSON.parse(tokenDataJson);
            // Ensure context.data exists
            context.data = context.data || {};
            // Add user info if available in the token data (e.g., if you stored email)
            if (tokenData && tokenData.email) {
                // You might not have the user's name easily available here, just the email.
                context.data.user = { email: tokenData.email };
                console.log(`Middleware: Added user email (${tokenData.email}) to context.data.`);
            }
        } catch (e) {
            // Log if parsing fails, but don't block the request just for this.
            console.warn("Middleware: Could not parse token data from ACCESS_TOKENS KV:", e);
        }

        // Optional: One-Time Use Token?
        // If you want the access token to be usable only *once*, delete it immediately after validation.
        // This adds security but means the user needs a new token for *every* request to a protected resource within the 5-min window.
        // await ACCESS_TOKENS.delete(accessToken); // Uncomment for strict one-time use

        // 5. Allow access to the requested resource (e.g., b.html or the next function in the chain)
        return await next();

    } catch (error) {
        // Handle potential errors during the KV lookup itself (e.g., network issues talking to KV)
        console.error(`Middleware: Error during KV lookup for access token ${accessToken?.substring(0, 8)}*** -`, error);
        // Return the custom error page in case of server-side validation errors
        return createAuthErrorResponse(request);
    }
}
