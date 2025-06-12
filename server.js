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
const csrfDebugMiddleware = require('./server/middleware/csrfDebugMiddleware');

dotenv.config({ path: "config.env" });

const app = express();
const PORT = process.env.PORT || 8080;

// Basic middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("tiny"));
// app.use(bodyParser.json()); // Commented out
// app.use(bodyParser.urlencoded({ extended: true })); // Commented out

// Setup sessions (necessary for CSRF)
app.use(session({
    secret: "secret123",
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false, // Set true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Enable Flash Messages
app.use(flash());

// Setup CSRF Protection globally (for res.locals.csrfToken)
// const csrfProtection = csrf({ cookie: false, debug: true }); // Added debug: true
// app.use(csrfProtection);
app.use(csrfDebugMiddleware);

// Pass CSRF Token and messages to all views
app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken ? req.csrfToken() : ''; // Ensure it's always defined
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
        // csrfToken: req.csrfToken() // No longer needed here, handled by res.locals
    });
});

// Load and use routes
const router = require("./server/routes/router");
app.use("/", router);

// CSRF token endpoint for AJAX
app.get('/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Error handler for CSRF token errors
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        // Handle CSRF token errors
        req.flash('error', 'Invalid CSRF token. Please try again.');
        return res.redirect('back');
    }
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

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});