const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD
            }
        });
    }

    // Send OTP email
    async sendOTP(email, otp) {
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: email,
            subject: 'Your Vergyl Login OTP',
            text: `Hello, your Vergyl login OTP is ${otp}. Please use this to sign in.`,
            html: `
                <h1>Welcome Back to Vergyl</h1>
                <p>Your login OTP is <b>${otp}</b></p>
                <p>This code is valid for 10 minutes. Please do not share it with anyone.</p>
            `
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', info.response);
            return {
                success: true,
                messageId: info.messageId,
                response: info.response
            };
        } catch (error) {
            console.error('Email sending failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Generic email sender
    async sendEmail(to, subject, text, html = null) {
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to,
            subject,
            text,
            html: html || text
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', info.response);
            return {
                success: true,
                messageId: info.messageId,
                response: info.response
            };
        } catch (error) {
            console.error('Email sending failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Send welcome email
    async sendWelcomeEmail(email, userName) {
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: email,
            subject: 'Welcome to Vergyl!',
            text: `Hello ${userName}, welcome to Vergyl! We're excited to have you on board.`,
            html: `
                <h1>Welcome to Vergyl, ${userName}!</h1>
                <p>We're excited to have you on board.</p>
                <p>Get started by exploring our features and let us know if you need any help.</p>
            `
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Welcome email sent:', info.response);
            return {
                success: true,
                messageId: info.messageId,
                response: info.response
            };
        } catch (error) {
            console.error('Welcome email failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Test email connection
    async testConnection() {
        try {
            await this.transporter.verify();
            console.log('SMTP connection is ready');
            return { success: true, message: 'Connection verified' };
        } catch (error) {
            console.error('SMTP connection failed:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = EmailService;