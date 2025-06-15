const express = require("express");
const dotenv = require("dotenv");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const connectDB = require("./server/database/connection");
const flash = require("connect-flash");
const csrf = require('csurf');
const multer = require('multer');
const path = require('path');

// Load environment variables from .env file
dotenv.config();

// Set default values for required environment variables
const env = {
    PORT: process.env.PORT || 3000,
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    SMTP_EMAIL: process.env.SMTP_EMAIL,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD
};

// Log environment configuration (without sensitive data)
console.log('Environment configuration:');
console.log('PORT:', env.PORT);
console.log('MONGO_URI:', env.MONGO_URI ? 'Set' : 'Not set');
console.log('JWT_SECRET:', env.JWT_SECRET ? 'Set' : 'Not set');
console.log('SMTP_EMAIL:', env.SMTP_EMAIL);
console.log('SMTP_PASSWORD:', env.SMTP_PASSWORD ? '******' : 'Not set');

const app = express();

// Trust the first proxy (Render's proxy)
app.set('trust proxy', 1);

// Basic middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("tiny"));

// Setup sessions (necessary for CSRF)
app.use(session({
    secret: env.JWT_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Enable Flash Messages
app.use(flash());

// Setup CSRF Protection globally
app.use(csrf({ cookie: true }));

// Pass CSRF Token and messages to all views
app.use((req, res, next) => {
    console.log('CSRF Token in res.locals:', req.csrfToken ? req.csrfToken() : 'Not available');
    res.locals.csrfToken = req.csrfToken(); // req.csrfToken() is available after csurf
    res.locals.messages = {
        success: req.flash("success"),
        error: req.flash("error")
    };
    next();
});

// Set EJS as view engine
app.set("view engine", "ejs");

// Serve static files
app.use(express.static("public"));

// Connect to MongoDB
connectDB();

// Start payment scheduler
require('./server/scheduler/paymentScheduler');

// Set `login.ejs` as the main page
app.get("/", (req, res) => {
    res.render("login", {
        username: "",
        messages: {
        error: req.flash("error"),
        success: req.flash("success")
        },
        // csrfToken is now available via res.locals
    });
});

// Load and use routes
const router = require("./server/routes/router");
app.use("/", router);

// CSRF token endpoint for AJAX
app.get('/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Error handler for CSRF token errors (MUST be after session, cookie-parser, body-parser, and csurf middleware)
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        console.error('CSRF Token Error:', err.message, 'from IP:', req.ip || req.connection.remoteAddress);
        // If the request expects JSON (e.g., AJAX call), send JSON error
        if (req.accepts('json')) {
            return res.status(403).json({ success: false, message: 'Invalid CSRF token. Please refresh the page and try again.' });
        }
        // Otherwise, redirect for traditional form submissions
        req.flash('error', 'Invalid CSRF token. Please refresh the page and try again.');
        return res.redirect('back');
    }
    // Pass other errors to the next error handler
    next(err);
});

// Add Multer error handling middleware
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading.
        console.error('Multer Error:', err.message);
        req.flash('error', `File upload error: ${err.message}`);
        return res.redirect('/adminannouncement'); // Redirect back to the form page
    } else if (err.message.includes('Not an image!')) {
        // Custom error from fileFilter
        console.error('File Filter Error:', err.message);
        req.flash('error', `File error: ${err.message}`);
        return res.redirect('/adminannouncement');
    } else {
        // Other errors
        console.error('General Server Error:', err);
        req.flash('error', 'An unexpected error occurred during file upload.');
        next(err); // Pass the error to the next error handler
    }
});

// Final error handler (catch all unhandled errors)
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    if (req.accepts('json')) {
        return res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
    }
    res.status(500).send('An unexpected error occurred.');
});

// Start Server
app.listen(env.PORT, () => {
    console.log(`Server is running on http://localhost:${env.PORT}`);
});