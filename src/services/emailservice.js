const nodemailer = require('nodemailer');

class EmailService {
    // Static method to detect email service from email address
    static getServiceFromEmail(email) {
        if (!email || typeof email !== 'string') {
            throw new Error('Invalid email address');
        }

        const domain = email.toLowerCase().split('@')[1];
        
        const serviceMap = {
            // Gmail
            'gmail.com': 'gmail',
            'googlemail.com': 'gmail',
            
            // Outlook/Hotmail/Live
            'outlook.com': 'outlook',
            'hotmail.com': 'outlook',
            'live.com': 'outlook',
            'msn.com': 'outlook',
        };

        return serviceMap[domain] || 'gmail'; // Default to gmail if unknown
    }

    // Static method to create EmailService instance from email
    static fromEmail(email) {
        const service = EmailService.getServiceFromEmail(email);
        return new EmailService(service);
    }

    constructor(provider = 'gmail') {
        let config;
        
        switch (provider.toLowerCase()) {
            case 'outlook':
            case 'hotmail':
                config = {
                    service: 'hotmail',
                    auth: {
                        user: process.env.OUTLOOK_USER,
                        pass: process.env.OUTLOOK_PASSWORD
                    }
                };
                this.fromEmail = process.env.OUTLOOK_USER;
                break;
            
            case 'gmail':
            default:
                config = {
                    service: 'gmail',
                    auth: {
                        user: process.env.GMAIL_USER,
                        pass: process.env.GMAIL_APP_PASSWORD
                    }
                };
                this.fromEmail = process.env.GMAIL_USER;
                break;
        }
        
        this.transporter = nodemailer.createTransport(config);
        this.provider = provider;
    }

    // Send OTP email
    async sendOTP(email, otp) {
        const mailOptions = {
            from: this.fromEmail,
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
            from: this.fromEmail,
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