const nodemailer = require('nodemailer');
const brevo = require('@getbrevo/brevo');

const transactionalEmailsApi = new brevo.TransactionalEmailsApi();
const contactsApi = new brevo.ContactsApi();
const emailApiKey = transactionalEmailsApi.authentications['apiKey'];
emailApiKey.apiKey = process.env.BREVO_API_KEY;

const contactsApiKey = contactsApi.authentications['apiKey'];
contactsApiKey.apiKey = process.env.BREVO_API_KEY;
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
         this.senderName = process.env.BREVO_SENDER_NAME || 'Your App';
        this.senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@yourdomain.com';
        // let config;
        
        // switch (provider.toLowerCase()) {
        //     case 'outlook':
        //     case 'hotmail':
        //         config = {
        //             service: 'hotmail',
        //             auth: {
        //                 user: process.env.OUTLOOK_USER,
        //                 pass: process.env.OUTLOOK_PASSWORD
        //             }
        //         };
        //         this.fromEmail = process.env.OUTLOOK_USER;
        //         break;
            
        //     case 'gmail':
        //     default:
        //         config = {
        //             service: 'gmail',
        //             auth: {
        //                 user: process.env.GMAIL_USER,
        //                 pass: process.env.GMAIL_APP_PASSWORD
        //             }
        //         };
        //         this.fromEmail = process.env.GMAIL_USER;
        //         break;
        // }
        
        // this.transporter = nodemailer.createTransport(config);
        // this.provider = provider;
    }

    // Send OTP email
    async sendOTP(email, otp) {
        const sendSmtpEmail = new brevo.SendSmtpEmail();
        
        sendSmtpEmail.sender = {
            name: this.senderName,
            email: this.senderEmail
        };
        
        sendSmtpEmail.to = [{ email: email }];
        sendSmtpEmail.subject = 'Your Vergyl Login OTP';
        
        sendSmtpEmail.textContent = `Hello, your Vergyl login OTP is ${otp}. Please use this to sign in.`;
        
        sendSmtpEmail.htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #333; text-align: center;">Welcome Back to Vergyl</h1>
                <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center; margin: 20px 0;">
                    <p style="font-size: 18px; margin-bottom: 10px;">Your login OTP is:</p>
                    <div style="font-size: 32px; font-weight: bold; color: #007cba; background: white; padding: 15px 25px; border-radius: 5px; display: inline-block; letter-spacing: 3px; border: 2px solid #e9ecef;">
                        ${otp}
                    </div>
                </div>
                <p style="color: #666; font-size: 14px; text-align: center;">
                    This code is valid for <strong>10 minutes</strong>. Please do not share it with anyone.
                </p>
                <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
                    If you didn't request this OTP, please ignore this email.
                </p>
            </div>
        `;
        
        // // Add tags for tracking
        sendSmtpEmail.tags = ['otp', 'login'];
        
        try {
            const result = await transactionalEmailsApi.sendTransacEmail(sendSmtpEmail);
            console.log('OTP email sent successfully:', result.body.messageId);
            return {
                success: true,
                messageId: result.messageId,
                response: `Email sent to ${email}`
            };
        } catch (error) {
            console.error('OTP email sending failed:', error);
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