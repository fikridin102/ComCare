const csrf = require('csurf');

const csrfProtection = csrf({ cookie: false });

const csrfDebugMiddleware = (req, res, next) => {
    console.log('=== CSRF Debug ===');
    console.log('Request Method:', req.method);
    console.log('Request URL:', req.url);
    console.log('Request Headers:', req.headers);
    console.log('Request Body (before csurf):', req.body);
    console.log('Session:', req.session);
    console.log('CSRF Secret:', req.session.csrfSecret);
    console.log('CSRF Token (from body):', req.body._csrf);
    console.log('==================');

    if (req.method === 'POST' && req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data')) {
        console.log('Skipping global CSRF check for multipart/form-data POST request. Calling next().');
        return next();
    }

    console.log('Executing csrfProtection for non-multipart/form-data or non-POST request.');
    csrfProtection(req, res, (err) => {
        if (err) {
            console.error('CSRF Error:', err);
            return next(err);
        }
        next();
    });
};

module.exports = csrfDebugMiddleware; 