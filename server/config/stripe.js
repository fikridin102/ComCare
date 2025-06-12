let stripe;
try {
    if (process.env.STRIPE_SECRET_KEY) {
        stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        console.log('Stripe initialized successfully');
    } else {
        console.warn('Warning: STRIPE_SECRET_KEY is not set. Stripe functionality will be disabled.');
        stripe = null;
    }
} catch (error) {
    console.error('Error initializing Stripe:', error.message);
    stripe = null;
}

module.exports = stripe; 