import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const sendEmailNotification = async (to: string, subject: string, text: string) => {
    try {
        await transporter.sendMail({
            from: `"B2B Platform" <${process.env.SMTP_USER}>`,
            to,
            subject,
            text,
        });
        console.log(`Email successfully sent to ${to}`);
    } catch (error) {
        console.error('Failed to send email notification:', error);
    }
};
