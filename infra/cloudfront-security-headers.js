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
function handler(event) {
    var response = event.response;
    var headers = response.headers;

    var csp = "default-src 'self'; " +
              "script-src 'self'; " +
              "style-src-elem 'self'; " +
              "style-src-attr 'unsafe-inline'; " +
              "img-src 'self' data: blob:; " +
              "font-src 'self'; " +
              "connect-src 'self' https://lb-code-agent.julesenergy.com https://sso-prod.julesenergy.com; " +
              "form-action 'self' https://sso-prod.julesenergy.com; " +
              "frame-ancestors 'self'; " +
              "object-src 'none'; " +
              "base-uri 'self'";

    headers['content-security-policy']    = { value: csp };
    headers['x-content-type-options']     = { value: 'nosniff' };
    headers['x-frame-options']            = { value: 'SAMEORIGIN' };
    headers['referrer-policy']            = { value: 'strict-origin-when-cross-origin' };
    headers['permissions-policy']         = { value: 'camera=(self), microphone=(self), geolocation=()' };
    headers['strict-transport-security']  = { value: 'max-age=63072000; includeSubDomains; preload' };

    return response;
}
