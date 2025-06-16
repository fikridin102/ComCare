const express = require("express");
const router = express.Router();
const { registerUser, loginUser } = require("../controllers/authController");
const adminController = require("../controllers/adminController");
const memberController = require("../controllers/memberController");
const paymentController = require("../controllers/paymentController");
const { isAuthenticated, isAdmin, isMember } = require("../middleware/authMiddleware");
const Payment = require("../models/payment");
const { format } = require('date-fns');
const announcementController = require('../controllers/announcementController');
const { uploadAnnouncement, uploadProfile } = require('../utils/multerConfig');
const User = require('../models/user');
const claimController = require("../controllers/claimController");
const dependantController = require('../controllers/dependantController');
const eventController = require('../controllers/eventController');
const csrf = require('csurf');
const nodemailer = require('nodemailer'); // Import nodemailer
const Dependant = require('../models/dependant');
const { sendEmail } = require('../utils/emailer');
const multer = require('multer'); // Re-import multer here to ensure it's available in this scope
const Claim = require('../models/claim');

// Setup CSRF Protection locally in router.js
// const csrfProtection = csrf({ cookie: false });
// const csrfProtection = csrfDebugMiddleware;

// Public Routes
router.get("/register", (req, res) => {
    res.render("register", { csrfToken: req.csrfToken() });
});

router.get("/login", (req, res) => {
    res.render("login", { username: "", csrfToken: req.csrfToken() });
});

// Auth Routes
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});

// Member Routes
router.get("/memberIndex", isAuthenticated, isMember, async (req, res) => {
    const userId = req.session.user._id || req.session.user.id;
    const overduePayments = await Payment.find({
        memberId: userId,
        paymentType: 'khairat',
        status: { $ne: 'Paid' },
        dueDate: { $lt: new Date() }
    });

    // Get total claims and approved claims
    const totalClaims = await Claim.find({ memberId: userId });
    const approvedClaims = await Claim.find({ 
        memberId: userId,
        status: 'Approved'
    });

    // Calculate total amount
    const totalClaimAmount = totalClaims.reduce((sum, claim) => sum + claim.amount, 0);
    const approvedClaimAmount = approvedClaims.reduce((sum, claim) => sum + claim.amount, 0);

    // Get dependants
    const dependants = await Dependant.find({ memberId: userId })
        .sort({ createdAt: -1 })
        .limit(5); // Show only the 5 most recent dependants

    res.render("memberIndex", {
        user: req.session.user,
        overduePayments,
        totalClaims: totalClaims.length,
        approvedClaims: approvedClaims.length,
        totalClaimAmount,
        approvedClaimAmount,
        dependants,
        messages: {
            error: req.flash('error'),
            success: req.flash('success')
        }
    });
});

router.get("/userprofile", isAuthenticated, isMember, async (req, res) => {
    const user = await User.findById(req.session.user.id);
    res.render("userProfile", {
        user,
        csrfToken: req.csrfToken(),
        messages: {
            error: req.flash('error'),
            success: req.flash('success')
        }
    });
});

// Member Dependant Routes
router.get("/memberdependant", isAuthenticated, isMember, memberController.getMemberDependants);
router.post("/memberdependant", isAuthenticated, isMember, memberController.addMemberDependant);
router.post("/memberdependant/:id/update", isAuthenticated, isMember, memberController.updateMemberDependant);
router.post("/memberdependant/:id/delete", isAuthenticated, isMember, memberController.deleteMemberDependant);

// Member Payment Routes
router.get("/memberpayment", isAuthenticated, isMember, paymentController.getPaymentHistory);
router.post("/memberpayment", isAuthenticated, isMember, paymentController.createPayment);
router.post("/create-payment-intent", isAuthenticated, isMember, paymentController.createPaymentIntent);
router.get("/payment-success", isAuthenticated, isMember, paymentController.handlePaymentSuccess);

// Password change route
router.post("/change-password", isAuthenticated, memberController.changePassword);

// Member Claim Routes
router.get("/memberclaim", isAuthenticated, isMember, claimController.getClaimPage);
router.post("/memberclaim", isAuthenticated, isMember, claimController.submitClaim);

// Admin Routes
router.get("/admindashboard", isAuthenticated, isAdmin, adminController.getAdminDashboard);
router.get("/adminprofile", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.session.user.id);
        if (!user) {
            req.flash('error', 'Admin user not found.');
            return res.redirect('/admindashboard');
        }

    res.render("adminprofile", {
            user,
        csrfToken: req.csrfToken(),
        messages: {
            error: req.flash('error'),
            success: req.flash('success')
        }
    });
    } catch (error) {
        console.error("Error fetching admin profile:", error);
        req.flash('error', 'Error fetching admin profile.');
        res.redirect('/admindashboard');
    }
});

// Admin Member Routes
router.get("/adminmember", isAuthenticated, isAdmin, memberController.getMemberList);
router.post("/adminmembers", isAuthenticated, isAdmin, memberController.addNewMember);
router.post("/adminmembers/edit/:id", isAuthenticated, isAdmin, memberController.editMember);
router.post("/adminmembers/delete/:id", isAuthenticated, isAdmin, memberController.deleteMember);
router.post("/adminmembers/status/:id", isAuthenticated, isAdmin, memberController.updateMemberStatus);

// Admin Dependant Routes
router.get("/admindependant", isAuthenticated, isAdmin, dependantController.getAllDependants);
router.post("/admindependant", isAuthenticated, isAdmin, dependantController.addDependant);
router.post("/admindependant/:id/update", isAuthenticated, isAdmin, dependantController.updateDependant);
router.post("/admindependant/:id/delete", isAuthenticated, isAdmin, dependantController.deleteDependant);

// Admin Event Routes
router.get("/adminevent", isAuthenticated, isAdmin, eventController.getEventList);
router.post("/adminevent", isAuthenticated, isAdmin, eventController.addEvent);
router.post("/adminevent/edit/:id", isAuthenticated, isAdmin, multer().none(), (req, res, next) => {
    console.log(`[Router] Hit POST /adminevent/edit/:id for ID: ${req.params.id}`);
    next();
}, eventController.editEvent);
router.post("/adminevent/delete/:id", isAuthenticated, isAdmin, eventController.deleteEvent);

// Admin Payment Routes
router.get("/adminpayment", isAuthenticated, isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const payments = await Payment.find()
            .populate('memberId', 'fullname')
            .sort({ paymentDate: -1 })
            .skip(skip)
            .limit(limit);

        const totalPayments = await Payment.countDocuments();
        const totalPages = Math.ceil(totalPayments / limit);

        const formattedPayments = payments.map(payment => ({
            ...payment.toObject(),
            memberName: payment.memberId.fullname
        }));

        res.render('adminPayment', {
            payments: formattedPayments,
            format,
            currentPage: page,
            totalPages,
            messages: {
                error: req.flash('error'),
                success: req.flash('success')
            },
            csrfToken: req.csrfToken(),
            user: req.session.user
        });
    } catch (error) {
        console.error('Error fetching payments:', error);
        req.flash('error', 'Error fetching payments');
        res.redirect('/admin/dashboard');
    }
});

// Admin Announcement Routes
router.get('/adminannouncement', isAuthenticated, isAdmin, announcementController.getAdminAnnouncement);
router.post('/adminannouncement', isAuthenticated, isAdmin, uploadAnnouncement.single('image'), announcementController.postAdminAnnouncement);
router.post('/adminannouncement/edit/:id', isAuthenticated, isAdmin, uploadAnnouncement.single('image'), announcementController.editAnnouncement);
router.post('/adminannouncement/delete/:id', isAuthenticated, isAdmin, announcementController.deleteAnnouncement);

// Public Announcement API Routes
router.get("/api/announcements/latest", announcementController.getLatestAnnouncement);
router.post("/api/announcements", isAuthenticated, isAdmin, uploadAnnouncement.single('image'), announcementController.createAnnouncement);
router.get("/api/announcements", announcementController.getAllAnnouncements);

// Profile Update Route
router.post("/update-profile", isAuthenticated, uploadProfile.single('profilePicture'), memberController.updateProfile);

// Admin Claim Routes
router.get("/adminclaim", isAuthenticated, isAdmin, claimController.getAdminClaims);
router.post("/adminclaim/:id/approve", isAuthenticated, isAdmin, claimController.approveClaim);
router.post("/adminclaim/reject/:id", isAuthenticated, isAdmin, claimController.rejectClaim);
router.get("/adminclaim/:id", isAuthenticated, isAdmin, claimController.getClaimDetails);

// API Routes
router.get("/api/members", isAuthenticated, async (req, res) => {
    try {
        const members = await User.find({ userType: 'member', status: 'Active' })
            .select('_id fullname');
        res.json(members);
    } catch (error) {
        console.error('Error fetching members:', error);
        res.status(500).json({ error: 'Error fetching members' });
    }
});

// Receipt Route
router.get('/receipt/:id', isAuthenticated, paymentController.viewReceipt);

// Forgot Password Route
router.post("/forgot-password", require("../controllers/authController").forgotPassword);

// Reset Password Routes
const authController = require("../controllers/authController");
router.get("/reset-password", authController.resetPasswordPage);
router.post("/reset-password", authController.resetPassword);

// API endpoint for user registration stats (for admin dashboard graph)
router.get("/api/user-registration-stats", isAuthenticated, isAdmin, adminController.getUserRegistrationStats);

module.exports = router;
