// /functions/_middleware.js

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
 * Universal middleware.
 * This will specifically protect /b.html by checking for a valid access_token.
 *
 * @param {EventContext<Env, any, { cf: CfProperties }>} context
 */
export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);
    const pathname = url.pathname;
    const functionName = "[universal-middleware]";

    // --- Target specific path for protection ---
    if (pathname === '/b.html') {
        console.log(`${functionName} Request received for protected path: ${pathname}`);

        // --- KV Binding ---
        const ACCESS_TOKENS = env.ACCESS_TOKENS;
        if (!ACCESS_TOKENS) {
            console.error(`${functionName} CRITICAL ERROR: Missing KV Binding! ACCESS_TOKENS is required for ${pathname}.`);
            return new Response("Server configuration error. Cannot verify access.", {
                status: 500,
                headers: { 'Content-Type': 'text/plain' }
            });
        }

        // --- Step 1: Get the Access Token from the cookie ---
        const accessToken = getCookie(request, 'access_token');

        if (!accessToken) {
            console.log(`${functionName} Access denied to ${pathname}. No 'access_token' cookie found.`);
            // Option 1: Nepali message (or any HTML/plain text)
            // return new Response("वेबसाइटको यो भाग प्रयोग गर्न पहिला लगइन गर्नुपर्छ। (Access to this part of the website requires login.)", {
            //     status: 401,
            //     headers: { 'Content-Type': 'text/html; charset=utf-8' }
            // });
            // Option 2: Redirect to index.html (or a login page)
            const redirectUrl = new URL('/', url.origin); // Redirect to root (index.html)
            console.log(`${functionName} Redirecting to ${redirectUrl.toString()}`);
            return Response.redirect(redirectUrl.toString(), 302);
        }

        console.log(`${functionName} Found 'access_token' cookie for ${pathname}: ${accessToken.substring(0, 8)}... Attempting verification.`);

        try {
            // --- Step 2: Look up access token in ACCESS_TOKENS KV ---
            const accessTokenDataJson = await ACCESS_TOKENS.get(accessToken);

            if (!accessTokenDataJson) {
                console.log(`${functionName} Access denied to ${pathname}. Access token ${accessToken.substring(0, 8)}*** is invalid, expired, or already used.`);

                const clearHeaders = new Headers();
                // Clear the invalid/used cookie from the browser
                clearHeaders.append('Set-Cookie', `access_token=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`);

                // Option 1: Nepali message
                // clearHeaders.append('Content-Type', 'text/html; charset=utf-8');
                // return new Response("तपाईंको पहुँच टोकन अमान्य, म्याद सकिएको वा पहिले नै प्रयोग भइसकेको छ। कृपया नयाँ उत्पन्न गर्नुहोस्। (Your access token is invalid, expired, or has already been used. Please generate a new one.)", {
                //     status: 401,
                //     headers: clearHeaders
                // });
                // Option 2: Redirect to index.html
                const redirectUrl = new URL('/', url.origin); // Redirect to root (index.html)
                console.log(`${functionName} Invalid token. Redirecting to ${redirectUrl.toString()} and clearing cookie.`);
                // Add the Set-Cookie header to the redirect response
                const redirectResponse = Response.redirect(redirectUrl.toString(), 302);
                redirectResponse.headers.append('Set-Cookie', clearHeaders.get('Set-Cookie'));
                return redirectResponse;
            }

            console.log(`${functionName} Access token ${accessToken.substring(0, 8)}... verified in ACCESS_TOKENS for ${pathname}.`);
            const accessTokenData = JSON.parse(accessTokenDataJson); // For logging or potential use
            console.log(`${functionName} Token was issued for: ${accessTokenData.email}`);


            // --- Step 3: Implement One-Time Use - Delete the token ---
            console.log(`${functionName} Deleting used access token ${accessToken.substring(0, 8)}*** from KV for one-time use for ${pathname}.`);
            context.waitUntil(ACCESS_TOKENS.delete(accessToken)); // Non-blocking delete

            // --- Step 4: Access Granted - Proceed to serve the static file /b.html ---
            console.log(`${functionName} Access granted to ${pathname}. Allowing static file serving.`);
            return await next(); // Let Pages serve the static /b.html

        } catch (error) {
            console.error(`${functionName} UNEXPECTED ERROR during access token verification for ${pathname}:`, error);
            return new Response("An internal server error occurred while verifying access.", {
                status: 500,
                headers: { 'Content-Type': 'text/plain' }
            });
        }
    }

    // --- If not /b.html, proceed to the next function or serve the asset ---
    // console.log(`${functionName} Path is not /b.html (${pathname}), passing through.`);
    return await next();
}
