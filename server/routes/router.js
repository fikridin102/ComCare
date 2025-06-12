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
const csrfDebugMiddleware = require('../middleware/csrfDebugMiddleware');
const nodemailer = require('nodemailer'); // Import nodemailer
const Dependant = require('../models/dependant');

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
router.post("/register", csrfDebugMiddleware, registerUser);
router.post("/login", csrfDebugMiddleware, loginUser);
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
    res.render("memberIndex", {
        user: req.session.user,
        overduePayments,
        messages: {
            error: req.flash('error'),
            success: req.flash('success')
        }
    });
});

router.get("/userprofile", isAuthenticated, isMember, async (req, res) => {
    const user = await User.findById(req.session.user.id);
    res.render("userprofile", {
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
router.post("/memberdependant", isAuthenticated, isMember, csrfDebugMiddleware, memberController.addMemberDependant);
router.post("/memberdependant/:id/update", isAuthenticated, isMember, csrfDebugMiddleware, memberController.updateMemberDependant);
router.post("/memberdependant/:id/delete", isAuthenticated, isMember, csrfDebugMiddleware, memberController.deleteMemberDependant);

// Member Payment Routes
router.get("/memberpayment", isAuthenticated, isMember, paymentController.getPaymentHistory);
router.post("/memberpayment", isAuthenticated, isMember, csrfDebugMiddleware, paymentController.createPayment);
router.post("/create-payment-intent", isAuthenticated, isMember, csrfDebugMiddleware, paymentController.createPaymentIntent);
router.get("/payment-success", isAuthenticated, isMember, paymentController.handlePaymentSuccess);

// Member Claim Routes
router.get("/memberclaim", isAuthenticated, isMember, claimController.getClaimPage);
router.post("/memberclaim", isAuthenticated, isMember, csrfDebugMiddleware, claimController.submitClaim);

// Admin Routes
router.get("/admindashboard", isAuthenticated, isAdmin, adminController.getAdminDashboard);
router.get("/adminprofile", isAuthenticated, isAdmin, (req, res) => {
    res.render("adminprofile", {
        user: req.session.user,
        csrfToken: req.csrfToken(),
        messages: {
            error: req.flash('error'),
            success: req.flash('success')
        }
    });
});

// Admin Member Routes
router.get("/adminmember", isAuthenticated, isAdmin, memberController.getMemberList);
router.post("/adminmembers", isAuthenticated, isAdmin, csrfDebugMiddleware, memberController.addNewMember);
router.post("/adminmembers/edit/:id", isAuthenticated, isAdmin, csrfDebugMiddleware, memberController.editMember);
router.post("/adminmembers/delete/:id", isAuthenticated, isAdmin, csrfDebugMiddleware, memberController.deleteMember);
router.post("/adminmembers/status/:id", isAuthenticated, isAdmin, csrfDebugMiddleware, memberController.updateMemberStatus);

// Admin Dependant Routes
router.get("/admindependant", isAuthenticated, isAdmin, dependantController.getAllDependants);
router.post("/admindependant", isAuthenticated, isAdmin, csrfDebugMiddleware, dependantController.addDependant);
router.post("/admindependant/:id/update", isAuthenticated, isAdmin, csrfDebugMiddleware, dependantController.updateDependant);
router.post("/admindependant/:id/delete", isAuthenticated, isAdmin, csrfDebugMiddleware, dependantController.deleteDependant);

// Admin Event Routes
router.get("/adminevent", isAuthenticated, isAdmin, eventController.getEventList);
router.post("/adminevent", isAuthenticated, isAdmin, csrfDebugMiddleware, eventController.addEvent);
router.post("/adminevent/edit/:id", isAuthenticated, isAdmin, csrfDebugMiddleware, eventController.editEvent);
router.post("/adminevent/delete/:id", isAuthenticated, isAdmin, csrfDebugMiddleware, eventController.deleteEvent);

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
router.post('/adminannouncement', isAuthenticated, isAdmin, uploadAnnouncement.single('image'), csrfDebugMiddleware, announcementController.postAdminAnnouncement);
router.post('/adminannouncement/edit/:id', isAuthenticated, isAdmin, uploadAnnouncement.single('image'), csrfDebugMiddleware, announcementController.editAnnouncement);
router.post('/adminannouncement/delete/:id', isAuthenticated, isAdmin, csrfDebugMiddleware, announcementController.deleteAnnouncement);

// Public Announcement API Routes
router.get("/api/announcements/latest", announcementController.getLatestAnnouncement);
router.post("/api/announcements", isAuthenticated, isAdmin, uploadAnnouncement.single('image'), csrfDebugMiddleware, announcementController.createAnnouncement);
router.get("/api/announcements", announcementController.getAllAnnouncements);

// Profile Update Route
router.post("/update-profile", isAuthenticated, uploadProfile.single('profilePicture'), csrfDebugMiddleware, async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Fetch the old user data before updating
        const oldUser = await User.findById(userId);
        if (!oldUser) {
            req.flash('error', 'User not found.');
            return res.redirect(req.session.user.userType === 'admin' ? '/adminprofile' : '/userprofile');
        }

        const updateData = { ...req.body };
        
        if (req.file) {
            updateData.profilePicture = '/uploads/profiles/' + req.file.filename;
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true }
        );

        if (!updatedUser) {
            req.flash('error', 'Failed to update profile.');
            return res.redirect(req.session.user.userType === 'admin' ? '/adminprofile' : '/userprofile');
        }

        // Compare old and new data to detect changes
        const changes = [];
        for (const key in req.body) {
            if (Object.prototype.hasOwnProperty.call(req.body, key)) {
                if (key === 'password' || key === 'passwordConfirm') continue; // Skip password fields for comparison
                
                const oldValue = oldUser[key];
                const newValue = req.body[key];

                if (oldValue !== newValue) {
                    changes.push(`${key}: ${oldValue || 'N/A'} -> ${newValue}`);
                }
            }
        }

        // Check for profile picture change
        if (req.file && oldUser.profilePicture !== updatedUser.profilePicture) {
            changes.push(`profilePicture: ${oldUser.profilePicture || 'N/A'} -> ${updatedUser.profilePicture}`);
        }

        // Send email notification to heir if changes occurred and heir exists
        if (changes.length > 0) {
            const heir = await Dependant.findOne({ memberId: userId, isHeir: true });
            if (heir && heir.heirEmail) {
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    }
                });

                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: heir.heirEmail,
                    subject: 'Member Profile Update Notification',
                    html: `
                        <p>Dear ${heir.name},</p>
                        <p>This is to inform you that the profile of ${updatedUser.fullname} has been updated.</p>
                        <p>Details of changes:</p>
                        <ul>
                            ${changes.map(change => `<li>${change}</li>`).join('')}
                        </ul>
                        <p>If you have any concerns, please contact support.</p>
                        <p>Best regards,<br>The ComCare Team</p>
                    `,
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('Error sending email notification to heir:', error);
                    } else {
                        console.log('Email notification sent to heir:', info.response);
                    }
                });
            }
        }

        req.session.user = {
            ...req.session.user,
            fullname: updatedUser.fullname,
            profilePicture: updatedUser.profilePicture
        };

        req.flash('success', 'Profile updated successfully');
        res.redirect(req.session.user.userType === 'admin' ? '/adminprofile' : '/userprofile');
    } catch (error) {
        console.error('Error updating profile:', error);
        req.flash('error', 'Error updating profile');
        res.redirect(req.session.user.userType === 'admin' ? '/adminprofile' : '/userprofile');
    }
});

// Admin Claim Routes
router.get("/adminclaim", isAuthenticated, isAdmin, claimController.getAdminClaims);
router.post("/adminclaim/:id/approve", isAuthenticated, isAdmin, csrfDebugMiddleware, claimController.approveClaim);
router.post("/adminclaim/reject/:id", isAuthenticated, isAdmin, csrfDebugMiddleware, claimController.rejectClaim);
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

module.exports = router;
