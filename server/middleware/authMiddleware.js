// Middleware to check if user is authenticated
exports.isAuthenticated = (req, res, next) => {
    console.log("=== Authentication Check ===");
    console.log("Session:", req.session);
    console.log("User:", req.session.user);
    
    if (req.session.user) {
        console.log("User is authenticated");
        return next();
    }
    console.log("User is not authenticated");
    req.flash("error", "Please login to access this page");
    res.redirect("/login");
};

// Middleware to check if user is admin
exports.isAdmin = (req, res, next) => {
    console.log("=== Admin Check ===");
    console.log("Session:", req.session);
    console.log("User:", req.session.user);
    
    if (req.session.user && req.session.user.userType === "admin") {
        console.log("User is admin");
        return next();
    }
    console.log("User is not admin");
    req.flash("error", "You do not have permission to access this page");
    res.redirect("/login");
};

// Middleware to check if user is member
exports.isMember = (req, res, next) => {
    console.log("=== Member Check ===");
    console.log("Session:", req.session);
    console.log("User:", req.session.user);
    
    if (req.session.user && req.session.user.userType === "member") {
        console.log("User is member");
        return next();
    }
    console.log("User is not member");
    req.flash("error", "You do not have permission to access this page");
    res.redirect("/login");
}; 