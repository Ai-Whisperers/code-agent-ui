/**
 * CloudFront Function — Security Headers (viewer response)
 *
 * Deployment:
 *   1. Go to AWS Console → CloudFront → Functions → Create function
 *   2. Paste this file, runtime: cloudfront-js-2.0
 *   3. Publish the function
 *   4. On your distribution → Behaviors → Edit → associate this function
 *      on the "Viewer response" event
 *
 * Or via AWS CLI:
 *   aws cloudfront create-function \
 *     --name code-agent-ui-security-headers \
 *     --function-config Comment="Security headers",Runtime=cloudfront-js-2.0 \
 *     --function-code fileb://infra/cloudfront-security-headers.js
 */
async function handler(event) {
    const headers = event.response.headers;

    // Fixes: "CSP policy does not define a fallback" (High)
    // Fixes: "CSP config allows inline javascript"   (High)  — no 'unsafe-inline' in script-src
    // Fixes: "CSP policy does not block unsafe URLs" (High)  — explicit allowlist, no http: wildcard
    // Mitigates: "CSP config allows inline CSS"      (Low)   — 'unsafe-inline' kept for Tailwind/shadcn runtime styles
    headers['content-security-policy'] = {
        value: [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self'",
            "connect-src 'self' https://lb-code-agent.julesenergy.com https://sso-prod.julesenergy.com",
            "form-action 'self' https://sso-prod.julesenergy.com",
            "frame-ancestors 'self'",
            "object-src 'none'",
            "base-uri 'self'",
        ].join('; '),
    };

    headers['x-content-type-options']  = { value: 'nosniff' };
    headers['x-frame-options']         = { value: 'SAMEORIGIN' };
    headers['referrer-policy']         = { value: 'strict-origin-when-cross-origin' };
    headers['permissions-policy']      = { value: 'camera=(), microphone=(), geolocation=()' };
    headers['strict-transport-security'] = { value: 'max-age=63072000; includeSubDomains; preload' };

    return event.response;
}
