const Payment = require('../models/payment');
const User = require('../models/user');
const Dependant = require('../models/dependant');
const nodemailer = require('nodemailer');
const { format } = require('date-fns');
const stripe = require('../config/stripe');
const PDFDocument = require('pdfkit');

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Calculate total amount based on member and dependants
const calculateTotalAmount = (selectedNames) => {
    const feePerPerson = 30; // RM30 per person
    return selectedNames.length * feePerPerson;
};

// Send warning email
const sendWarningEmail = async (user, warningNumber) => {
    const warningMessages = {
        1: "First Warning: Your khairat payment is overdue. Please make payment within 30 days.",
        2: "Second Warning: Your khairat payment is still overdue. Please make payment immediately.",
        3: "Final Warning: Your khairat payment is severely overdue. Your account will be deactivated if payment is not made."
    };

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: `Khairat Payment Warning (${warningNumber})`,
        text: warningMessages[warningNumber]
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending warning email:', error);
    }
};

// Check and update payment status
const checkPaymentStatus = async () => {
    const payments = await Payment.find({ status: 'Pending' });
    const now = new Date();

    for (const payment of payments) {
        const dueDate = new Date(payment.dueDate);
        const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

        if (daysOverdue > 0) {
            if (daysOverdue > 30 && payment.warningCount === 0) {
                payment.warningCount = 1;
                payment.lastWarningDate = now;
                await sendWarningEmail(await User.findById(payment.memberId), 1);
            } else if (daysOverdue > 60 && payment.warningCount === 1) {
                payment.warningCount = 2;
                payment.lastWarningDate = now;
                await sendWarningEmail(await User.findById(payment.memberId), 2);
            } else if (daysOverdue > 90 && payment.warningCount === 2) {
                payment.warningCount = 3;
                payment.lastWarningDate = now;
                await sendWarningEmail(await User.findById(payment.memberId), 3);
                
                // Deactivate user account
                const user = await User.findById(payment.memberId);
                if (user) {
                    user.status = 'Inactive';
                    await user.save();
                }
            }

            payment.status = 'Overdue';
            await payment.save();
        }
    }
};

// Add a middleware to check if Stripe is available
const checkStripeAvailability = (req, res, next) => {
    if (!stripe) {
        return res.status(503).json({
            success: false,
            message: 'Payment service is currently unavailable. Please try again later.'
        });
    }
    next();
};

// Create Stripe payment intent
exports.createPaymentIntent = async (req, res) => {
    try {
        const { amount, paymentType, paymentMethod, selectedNames } = req.body;
        const memberId = req.session.user._id || req.session.user.id;
        
        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents and ensure it's an integer
            currency: 'myr',
            payment_method_types: paymentMethod === 'FPX' ? ['fpx'] : ['card'],
            metadata: {
                memberId: memberId,
                paymentType: paymentType,
                selectedNames: JSON.stringify(selectedNames) // Store selectedNames in metadata
            }
        });

        res.json({
            clientSecret: paymentIntent.client_secret
        });
    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ error: 'Error creating payment intent' });
    }
};

// Handle successful payment
exports.handlePaymentSuccess = async (req, res) => {
    try {
        const { payment_intent, payment_intent_client_secret } = req.query;
        
        // Retrieve the payment intent to confirm it was successful
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent);
        
        if (paymentIntent.status === 'succeeded') {
            let selectedNames = [];
            // Retrieve selected names from metadata if available
            if (paymentIntent.metadata.selectedNames) {
                try {
                    selectedNames = JSON.parse(paymentIntent.metadata.selectedNames);
                } catch (e) {
                    console.error('Error parsing selectedNames from metadata:', e);
                    // Fallback or error handling if parsing fails
                }
            }
            
            // Create payment record
            const payment = new Payment({
                memberId: paymentIntent.metadata.memberId,
                amount: paymentIntent.amount / 100, // Convert from cents
                paymentDate: new Date(),
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1 month from now
                paymentMethod: 'FPX',
                referenceNumber: paymentIntent.id,
                paymentType: paymentIntent.metadata.paymentType,
                paymentIntentId: payment_intent,
                status: 'Paid',
                dependantsCount: paymentIntent.metadata.paymentType === 'maintenance' ? 0 : selectedNames.length,
                selectedNames: paymentIntent.metadata.paymentType === 'khairat' ? selectedNames : []
            });

            await payment.save();
            req.flash('success', 'Payment completed successfully');
        } else {
            req.flash('error', 'Payment was not successful');
        }
        
        res.redirect('/memberPayment');
    } catch (error) {
        console.error('Error handling payment success:', error);
        req.flash('error', 'Error processing payment');
        res.redirect('/memberPayment');
    }
};

// Create new payment
exports.createPayment = async (req, res) => {
    try {
        const { paymentMethod, referenceNumber, paymentType, paymentIntentId, selectedNames } = req.body;
        const memberId = req.session.user._id || req.session.user.id;
        console.log('Creating payment with data:', {
            paymentMethod,
            referenceNumber,
            paymentType,
            paymentIntentId,
            memberId,
            selectedNames
        });
        
        const user = await User.findById(memberId);
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/memberPayment');
        }

        let amount;
        // For credit card payments, get the amount from the payment intent
        if (paymentMethod === 'Credit Card') {
            try {
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
                amount = paymentIntent.amount / 100; // Convert from cents to dollars
            } catch (error) {
                console.error('Error retrieving payment intent:', error);
                req.flash('error', 'Error verifying payment');
                return res.redirect('/memberPayment');
            }
        } else {
            // For other payment methods, calculate the amount
        if (paymentType === 'maintenance') {
            amount = 400; // RM400 for maintenance fee
        } else {
            // For Khairat payments, calculate based on selected names
            amount = calculateTotalAmount(selectedNames);
            }
        }

        const dueDate = new Date();
        if (paymentType === 'khairat') {
            dueDate.setMonth(11); // Set to December
            dueDate.setDate(31); // Set to last day of December
        } else if (paymentType === 'maintenance') {
            dueDate.setMonth(dueDate.getMonth() + 1); // Move to next month
            dueDate.setDate(0); // Set to last day of the month
        } else {
            dueDate.setFullYear(dueDate.getFullYear() + 1);
        }

        // For credit card payments, use the payment intent ID as reference number
        const finalReferenceNumber = paymentMethod === 'Credit Card' ? paymentIntentId : referenceNumber;

        let parsedSelectedNames = selectedNames;
        if (typeof parsedSelectedNames === 'string') {
            try {
                parsedSelectedNames = JSON.parse(parsedSelectedNames);
            } catch (e) {
                parsedSelectedNames = [];
            }
        }

        const payment = new Payment({
            memberId,
            amount,
            dueDate,
            paymentMethod,
            referenceNumber: finalReferenceNumber,
            paymentType,
            paymentIntentId,
            status: 'Paid',
            dependantsCount: paymentType === 'maintenance' ? 0 : parsedSelectedNames.length,
            selectedNames: paymentType === 'khairat' ? parsedSelectedNames : []
        });

        await payment.save();
        console.log('Payment saved successfully:', payment);
        req.flash('success', 'Payment created successfully');
        res.redirect('/memberPayment');
    } catch (error) {
        console.error('Error creating payment:', error);
        req.flash('error', 'Error creating payment');
        res.redirect('/memberPayment');
    }
};

// Get payment history
exports.getPaymentHistory = async (req, res) => {
    try {
        const memberId = req.session.user._id || req.session.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        
        const payments = await Payment.find({ memberId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalPayments = await Payment.countDocuments({ memberId });
        const totalPages = Math.ceil(totalPayments / limit);

        // Get all dependants for the member
        const dependants = await Dependant.find({ memberId });
        const dependantsCount = dependants.length;
        
        res.render('memberPayment', { 
            payments,
            format,
            user: req.session.user,
            dependants,
            dependantsCount,
            currentPage: page,
            totalPages,
            messages: {
                error: req.flash('error'),
                success: req.flash('success')
            },
            csrfToken: req.csrfToken()
        });
    } catch (error) {
        console.error('Error fetching payment history:', error);
        req.flash('error', 'Error fetching payment history');
        res.redirect('/memberPayment');
    }
};

// Schedule payment status check
setInterval(checkPaymentStatus, 24 * 60 * 60 * 1000); // Check daily 

// Generate and stream PDF receipt
exports.viewReceipt = async (req, res) => {
    const paymentId = req.params.id;
    const payment = await Payment.findById(paymentId).populate('memberId');
    if (!payment) return res.status(404).send('Receipt not found');

    // Optionally: check if user is owner or admin here

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=receipt-${payment._id}.pdf`);

    const doc = new PDFDocument();
    doc.pipe(res);

    doc.fontSize(20).text('Payment Receipt', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Receipt No: ${payment._id}`);
    doc.text(`Date: ${payment.paymentDate.toLocaleDateString()}`);
    doc.text(`Member: ${payment.memberId.fullname}`);
    doc.text(`Payment Type: ${payment.paymentType}`);
    doc.text(`Amount: RM${payment.amount.toFixed(2)}`);
    doc.text(`Status: ${payment.status}`);
    doc.text(`Reference No: ${payment.referenceNumber}`);
    doc.text(`Due Date: ${payment.dueDate.toLocaleDateString()}`);
    doc.moveDown();
    doc.text('Thank you for your payment!', { align: 'center' });

    doc.end();
}; 

// Get all payments
exports.getAllPayments = async (req, res) => {
    try {
        const payments = await Payment.find()
            .populate('memberId', 'fullname')
            .sort({ paymentDate: -1 });

        // Transform the data to include member names
        const formattedPayments = payments.map(payment => ({
            ...payment.toObject(),
            memberName: payment.memberId.fullname
        }));

        res.render('adminPayment', {
            payments: formattedPayments,
            format,
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
};

// Get payment details
exports.getPaymentDetails = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id)
            .populate('memberId', 'fullname email');

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        res.json({
            ...payment.toObject(),
            memberName: payment.memberId.fullname
        });
    } catch (error) {
        console.error('Error fetching payment details:', error);
        res.status(500).json({ error: 'Error fetching payment details' });
    }
};

// Send payment reminder
exports.sendPaymentReminder = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id)
            .populate('memberId', 'fullname email');

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: payment.memberId.email,
            subject: 'Payment Reminder',
            text: `Dear ${payment.memberId.fullname},\n\n` +
                  `This is a reminder that your payment of RM${payment.amount.toFixed(2)} for ` +
                  `${payment.paymentType === 'khairat' ? 'Khairat Fee' : 'Maintenance Fee'} is overdue.\n\n` +
                  `Please make the payment as soon as possible to avoid any penalties.\n\n` +
                  `Best regards,\n` +
                  `Admin Team`
        };

        await transporter.sendMail(mailOptions);
        
        // Update warning count
        payment.warningCount = (payment.warningCount || 0) + 1;
        payment.lastWarningDate = new Date();
        await payment.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error sending reminder:', error);
        res.status(500).json({ error: 'Error sending reminder' });
    }
};

// Render a receipt page for a payment
exports.getReceipt = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id).populate('memberId');
        if (!payment) {
            return res.status(404).render('404', { message: 'Receipt not found' });
        }
        res.render('receipt', {
            payment,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error rendering receipt:', error);
        res.status(500).render('500', { message: 'Error rendering receipt' });
    }
};
