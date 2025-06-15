const csurf = require('csurf');

// Create the CSRF protection middleware instance
const csrfProtection = csurf({ cookie: true });

function csrfDebugMiddleware(req, res, next) {
    // Log all headers for debugging
    console.log('=== CSRF Debug ===');
    console.log('Request Method:', req.method);
    console.log('Request URL:', req.originalUrl);
    console.log('Request Headers:', req.headers);
    console.log('Request Body (before csurf):', req.body); // body might be empty/parsed here
    console.log('Session:', req.session);
    console.log('CSRF Secret (from session):', req.session.csrfSecret); // Access secret from session
    console.log('CSRF Token (from header):', req.headers['x-csrf-token']); // Check header
    console.log('CSRF Token (from body):', req.body._csrf); // Check body
    console.log('==================');

    // Exclude Stripe webhook and multipart/form-data from CSRF protection
    if (req.originalUrl === '/webhook' || req.is('multipart/form-data')) {
        console.log('Skipping CSRF protection for:', req.originalUrl);
        return next();
    }

    // Apply actual CSRF protection
    csrfProtection(req, res, next);
}

module.exports = csrfDebugMiddleware; 