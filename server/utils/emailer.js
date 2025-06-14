const nodemailer = require('nodemailer');

// Create reusable transporter
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

// Function to send email
const sendEmail = async (to, subject, html) => {
    try {
        console.log('=== EMAIL SENDING ATTEMPT ===');
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log('From:', process.env.SMTP_EMAIL);
        console.log('SMTP Config:', {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            user: process.env.SMTP_EMAIL ? 'Set' : 'Not Set',
            pass: process.env.SMTP_PASSWORD ? 'Set' : 'Not Set'
        });

        const mailOptions = {
            from: process.env.SMTP_EMAIL,
            to: to,
            subject: subject,
            html: html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('=== EMAIL SENT SUCCESSFULLY ===');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
        console.log('=============================');
        return true;
    } catch (error) {
        console.error('=== EMAIL SENDING FAILED ===');
        console.error('Error:', error.message);
        console.error('Code:', error.code);
        console.error('Command:', error.command);
        console.error('Stack:', error.stack);
        console.error('===========================');
        return false;
    }
};

// Function to notify heir about member activities
const notifyHeir = async (memberId, subject, message) => {
    try {
        console.log('=== HEIR NOTIFICATION ATTEMPT ===');
        console.log('Member ID:', memberId);
        console.log('Subject:', subject);
        
        const Dependant = require('../models/dependant');
        const heir = await Dependant.findOne({ 
            memberId: memberId, 
            isHeir: true 
        });

        console.log('Heir found:', heir ? 'Yes' : 'No');
        if (heir) {
            console.log('Heir details:', {
                name: heir.name,
                email: heir.heirEmail,
                isHeir: heir.isHeir
            });
        }

        if (heir && heir.heirEmail) {
            const html = `
                <p>Dear ${heir.name},</p>
                <p>${message}</p>
                <p>Best regards,<br>The ComCare Team</p>
            `;

            const emailSent = await sendEmail(heir.heirEmail, subject, html);
            console.log('=== HEIR NOTIFICATION RESULT ===');
            console.log('Email sent:', emailSent ? 'Success' : 'Failed');
            console.log('===============================');
            return emailSent;
        } else {
            console.log('=== HEIR NOTIFICATION SKIPPED ===');
            console.log('Reason: No heir email found for member:', memberId);
            console.log('=================================');
        }
        return false;
    } catch (error) {
        console.error('=== HEIR NOTIFICATION ERROR ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('==============================');
        return false;
    }
};

module.exports = { sendEmail, notifyHeir }; 