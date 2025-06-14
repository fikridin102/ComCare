const User = require("../models/user");
const bcrypt = require("bcryptjs");
const Dependant = require("../models/dependant");
const Event = require("../models/event");
const Payment = require('../models/payment');
const { format } = require('date-fns');
const nodemailer = require('nodemailer');
const Claim = require('../models/claim');

// Email configuration
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD
    },
    tls: {
        rejectUnauthorized: false
    }
});

exports.getAdminDashboard = async (req, res) => {
    try {
        const totalMembers = await User.countDocuments({ userType: 'member' });
        const totalDependants = await Dependant.countDocuments();
        const totalPayments = await Payment.countDocuments();
        const totalClaims = await Claim.countDocuments();

        res.render('adminDashboard', {
            totalMembers,
            totalDependants,
            totalPayments,
            totalClaims,
            user: req.session.user
        });
    } catch (error) {
        res.render('adminDashboard', {
            totalMembers: 0,
            totalDependants: 0,
            totalPayments: 0,
            totalClaims: 0,
            user: req.session.user
        });
    }
};







