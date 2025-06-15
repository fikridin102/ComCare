const User = require("../models/user");
const bcrypt = require("bcryptjs");
const { calculateAge } = require("../utils/dateUtils");
const crypto = require('crypto');
const { sendEmail } = require('../utils/emailer');

exports.registerUser = async (req, res) => {
    try {
        const {
            fullname,
            username,
            email,
            icNum,
            birthDate,
            age,
            address,
            phoneNum,
            password,
            passwordConfirm
        } = req.body;

        // Validate passwords match
        if (password !== passwordConfirm) {
            req.flash("error", "Passwords do not match");
            return res.redirect("/register");
        }

        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            req.flash("error", "User already exists");
            return res.redirect("/register");
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Find the latest user based on customId
        const latestUser = await User.findOne({ customId: { $exists: true } }).sort({ customId: -1 });

        let newCustomId = "CC01"; // Default if no user found

        if (latestUser && latestUser.customId) {
            const lastNumber = parseInt(latestUser.customId.slice(2)) || 0;
            const nextNumber = lastNumber + 1;
            newCustomId = "CC" + String(nextNumber).padStart(2, "0");
        }

        // Create new user with generated customId
        user = new User({
            customId: newCustomId,
            fullname,
            username,
            email,
            icNum,
            birthDate,
            age:calculateAge(birthDate),
            address,
            phoneNum,
            password: hashedPassword,
            userType: "member",
            status: "Inactive"
        });

        await user.save();
        console.log("Saved user with customId:", user.customId); // ✅ This should now log correctly

        req.flash("success", "Registration successful! Please log in.");
        res.redirect("/login");
    } catch (error) {
        console.error("Registration error:", error);
        req.flash("error", "Server error. Please try again later.");
        res.redirect("/register");
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            req.flash("error", "Invalid username or password");
            return res.redirect("/login");
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            req.flash("error", "Invalid username or password");
            return res.redirect("/login");
        }

        // Check if user is active
        if (user.status !== "Active") {
            req.flash("error", "Your account is not active. Please contact the administrator.");
            return res.redirect("/login");
        }

        // Create session
        req.session.user = {
            id: user._id,
            username: user.username,
            userType: user.userType,
            fullname: user.fullname,
            ic: user.icNum
        };

        // Redirect based on user type
        if (user.userType === "admin") {
            req.flash("success", "Welcome back, Admin!");
            res.redirect("/admindashboard");
        } else {
            req.flash("success", "Welcome back, " + user.fullname + "!");
            res.redirect("/memberIndex");
        }
    } catch (error) {
        console.error("Login error:", error);
        req.flash("error", "Server error. Please try again later.");
        res.redirect("/login");
    }
};

exports.logoutUser = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Logout error:", err);
            req.flash("error", "Error logging out. Please try again.");
            return res.redirect("/dashboard");
        }
        res.redirect("/login");
    });
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required.' });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'No account found with that email.' });
        }
        // Generate token
        const token = crypto.randomBytes(32).toString('hex');
        const tokenExpiry = Date.now() + 1000 * 60 * 60; // 1 hour
        user.resetPasswordToken = token;
        user.resetPasswordExpires = tokenExpiry;
        await user.save();
        // Send email
        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;
        const subject = 'Password Reset Request';
        const html = `<p>Dear ${user.fullname},</p>
            <p>You requested a password reset. Click the link below to reset your password:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>If you did not request this, please ignore this email.</p>
            <p>Best regards,<br>The ComCare Team</p>`;
        await sendEmail(user.email, subject, html);
        return res.status(200).json({ success: true, message: 'Password reset link sent to your email.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
};

exports.resetPasswordPage = async (req, res) => {
    const { token } = req.query;
    if (!token) {
        return res.render('resetPassword', { error: 'Invalid or missing token.', csrfToken: req.csrfToken() });
    }
    const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
    if (!user) {
        return res.render('resetPassword', { error: 'Password reset token is invalid or has expired.', csrfToken: req.csrfToken() });
    }
    res.render('resetPassword', { error: null, csrfToken: req.csrfToken(), token });
};

exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword, confirmPassword } = req.body;
        if (!token || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Passwords do not match.' });
        }
        const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Password reset token is invalid or has expired.' });
        }
        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        // Optionally send confirmation email
        await sendEmail(user.email, 'Password Reset Successful', `<p>Your password has been reset successfully.</p>`);
        return res.status(200).json({ success: true, message: 'Password has been reset successfully.' });
    } catch (error) {
        console.error('Reset password error:', error);
        return res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
};
