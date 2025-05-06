// /protected/_middleware.js
// This middleware will run for all files in the protected directory

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
            const cookieName = decodeURIComponent(parts.shift()?.trim() || '');
            if (cookieName === name) {
                result = decodeURIComponent(parts.join('=').trim());
            }
        });
    }
    return result;
}

/**
 * Generates the custom Nepali error page HTML.
 * @returns {string} HTML string for the error page.
 */
function getNepaliErrorPage() {
    return `
<!DOCTYPE html>
<html lang="ne">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>त्रुटि - पहुँच अस्वीकृत</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; color: #333; text-align: center; }
        .container { background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); display: inline-block; }
        h1 { color: #d9534f; }
        p { font-size: 1.1em; line-height: 1.6; }
        a { color: #007bff; text-decoration: none; font-weight: bold; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1>पहुँचमा त्रुटि!</h1>
        <p>सर्भर (server) सँग जडान गर्न खोज्दा त्रुटि भयो।</p>
        <p>कृपया यो पेज खोलेपछि रिफ्रेस नगर्नुहोला।</p>
        <p>यो संवेदनशील साइट (site) हो, त्यसैले रिफ्रेस गर्दा तपाईंको पुरानो डाटासँग जडान हुँदैन।</p>
        <p>कृपया <a href="/">होम पेज (home page)</a> मा गएर फेरि प्रयास गर्नुहोला।</p>
        <p>धन्यवाद!</p>
    </div>
</body>
</html>
`;
}

/**
 * Middleware to protect all files in the protected directory.
 * Validates 'access_token', and if valid, grants access ONCE by deleting the token.
 */
export async function onRequest(context) {
    const { request, env, next } = context;
    const functionName = "[protected-middleware]";

    // Ensure KV binding is present
    const ACCESS_TOKENS = env.ACCESS_TOKENS;
    if (!ACCESS_TOKENS) {
        console.error(`${functionName} CRITICAL ERROR: Missing KV Binding! ACCESS_TOKENS is required.`);
        // Return a generic server error if KV is not configured
        return new Response("Server configuration error.", { status: 500 });
    }

    // --- Step 1: Get the access_token cookie ---
    const accessToken = getCookie(request, 'access_token');

    if (!accessToken) {
        console.log(`${functionName} Access denied to protected content. No 'access_token' cookie found.`);
        return new Response(getNepaliErrorPage(), {
            status: 403, // Forbidden
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }

    console.log(`${functionName} Found 'access_token' cookie: ${accessToken.substring(0, 8)}... Attempting validation.`);

    try {
        // --- Step 2: Validate access token against ACCESS_TOKENS KV ---
        const tokenDataJson = await ACCESS_TOKENS.get(accessToken);

        if (!tokenDataJson) {
            console.log(`${functionName} Access denied. Access token '${accessToken.substring(0, 8)}...' is invalid or expired (not found in KV).`);
            // The token might be stale in the cookie, attempt to clear it
            const clearHeaders = new Headers({ 'Content-Type': 'text/html; charset=utf-8' });
            clearHeaders.append('Set-Cookie', `access_token=; Path=/; Max-Age=0; Secure; SameSite=Lax`);
            return new Response(getNepaliErrorPage(), {
                status: 403, // Forbidden
                headers: clearHeaders
            });
        }

        // --- Step 3: Token is VALID. Consume it (delete from KV) ---
        console.log(`${functionName} Access token '${accessToken.substring(0, 8)}...' is VALID. Consuming token.`);
        await ACCESS_TOKENS.delete(accessToken);
        console.log(`${functionName} Access token '${accessToken.substring(0, 8)}...' deleted from KV.`);

        // --- Step 4: Proceed to serve the content and clear the cookie from the client ---
        const response = await next();

        // Create a new Headers object based on the original response's headers
        const responseHeaders = new Headers(response.headers);

        // Add the Set-Cookie header to clear the access_token from the client's browser
        responseHeaders.append(
            'Set-Cookie',
            `access_token=; Path=/; Max-Age=0; Secure; SameSite=Lax`
        );
        console.log(`${functionName} 'access_token' cookie will be cleared from client.`);

        // Return the original response but with the modified headers
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders
        });

    } catch (error) {
        console.error(`${functionName} UNEXPECTED ERROR processing access:`, error);
        return new Response(getNepaliErrorPage(), {
            status: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
}
