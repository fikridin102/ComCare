const User = require("../models/user");
const bcrypt = require("bcryptjs");
const Dependant = require("../models/dependant");
const Event = require("../models/event");
const Payment = require('../models/payment');
const { format } = require('date-fns');
const nodemailer = require('nodemailer');
const Claim = require('../models/claim');
const Announcement = require('../models/announcement');

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
        // Get member counts
        const totalMembers = await User.countDocuments({ userType: 'member' });
        const totalActiveMembers = await User.countDocuments({ userType: 'member', isActive: true });
        const totalDependants = await Dependant.countDocuments();
        const totalPayments = await Payment.countDocuments();
        const totalClaims = await Claim.countDocuments();

        // Get payment totals
        const khairatPayments = await Payment.aggregate([
            { $match: { paymentType: 'khairat', status: 'Paid' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const maintenancePayments = await Payment.aggregate([
            { $match: { paymentType: 'maintenance', status: 'Paid' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // Get latest announcements
        const announcements = await Announcement.find()
            .sort({ createdAt: -1 })
            .limit(5);

        const totalKhairat = khairatPayments[0]?.total || 0;
        const totalMaintenance = maintenancePayments[0]?.total || 0;

        res.render('adminDashboard', {
            totalMembers,
            totalActiveMembers,
            totalDependants,
            totalPayments,
            totalClaims,
            totalKhairat,
            totalMaintenance,
            announcements,
            user: req.session.user,
            format
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.render('adminDashboard', {
            totalMembers: 0,
            totalActiveMembers: 0,
            totalDependants: 0,
            totalPayments: 0,
            totalClaims: 0,
            totalKhairat: 0,
            totalMaintenance: 0,
            announcements: [],
            user: req.session.user,
            format
        });
    }
};

// API endpoint: Get user registration stats for the last 12 months
exports.getUserRegistrationStats = async (req, res) => {
    try {
        const period = req.query.period || 'month';
        const now = new Date();
        let startDate, labels = [], groupId;

        if (period === 'week') {
            // Last 7 days
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
                labels.push({
                    year: d.getFullYear(),
                    month: d.getMonth(),
                    day: d.getDate(),
                    label: d.toLocaleDateString('default', { weekday: 'short', day: 'numeric' })
                });
            }
            groupId = { year: { $year: "$createdAt" }, month: { $month: "$createdAt" }, day: { $dayOfMonth: "$createdAt" } };
        } else if (period === 'year') {
            // Last 12 months
            startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
            for (let i = 11; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                labels.push({
                    year: d.getFullYear(),
                    month: d.getMonth(),
                    label: d.toLocaleString('default', { month: 'short', year: 'numeric' })
                });
            }
            groupId = { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } };
        } else {
            // Default: last 30 days
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
            for (let i = 29; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
                labels.push({
                    year: d.getFullYear(),
                    month: d.getMonth(),
                    day: d.getDate(),
                    label: d.toLocaleDateString('default', { month: 'short', day: 'numeric' })
                });
            }
            groupId = { year: { $year: "$createdAt" }, month: { $month: "$createdAt" }, day: { $dayOfMonth: "$createdAt" } };
        }

        const stats = await User.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: now },
                    userType: 'member'
                }
            },
            {
                $group: {
                    _id: groupId,
                    count: { $sum: 1 }
                }
            }
        ]);

        // Map stats to labels
        const data = labels.map(l => {
            let found;
            if (period === 'year') {
                found = stats.find(s =>
                    s._id.year === l.year &&
                    s._id.month === l.month + 1
                );
            } else {
                found = stats.find(s =>
                    s._id.year === l.year &&
                    s._id.month === l.month + 1 &&
                    s._id.day === l.day
                );
            }
            return {
                label: l.label,
                count: found ? found.count : 0
            };
        });

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching registration stats:', error);
        res.status(500).json({ success: false, message: 'Error fetching registration stats' });
    }
};














