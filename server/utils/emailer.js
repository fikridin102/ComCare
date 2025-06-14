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
        console.log('Attempting to send email to:', to);
        console.log('Using SMTP email:', process.env.SMTP_EMAIL);

        const mailOptions = {
            from: process.env.SMTP_EMAIL,
            to: to,
            subject: subject,
            html: html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.response);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            command: error.command
        });
        return false;
    }
};

// Function to notify heir about member activities
const notifyHeir = async (memberId, subject, message) => {
    try {
        console.log('Attempting to notify heir for member:', memberId);
        
        const Dependant = require('../models/dependant');
        const heir = await Dependant.findOne({ 
            memberId: memberId, 
            isHeir: true 
        });

        console.log('Found heir:', heir ? 'Yes' : 'No');
        if (heir) {
            console.log('Heir email:', heir.heirEmail);
        }

        if (heir && heir.heirEmail) {
            const html = `
                <p>Dear ${heir.name},</p>
                <p>${message}</p>
                <p>Best regards,<br>The ComCare Team</p>
            `;

            const emailSent = await sendEmail(heir.heirEmail, subject, html);
            console.log('Email sent to heir:', emailSent ? 'Yes' : 'No');
            return emailSent;
        } else {
            console.log('No heir email found for member:', memberId);
        }
        return false;
    } catch (error) {
        console.error('Error notifying heir:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
        return false;
    }
};

module.exports = { sendEmail, notifyHeir }; 