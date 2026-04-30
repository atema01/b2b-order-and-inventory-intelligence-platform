require('dotenv').config({ path: 'c:\\Users\\atema\\Desktop\\project implementation\\b2b-order-and-inventory-intellignece-platform\\server\\.env' });
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

async function main() {
  try {
    let info = await transporter.sendMail({
      from: `"Test" <${process.env.SMTP_USER}>`,
      to: process.env.SELLER_EMAIL,
      subject: "Test Email",
      text: "This is a test email",
    });
    console.log("Message sent: %s", info.messageId);
  } catch(error) {
    console.error("Error formatting email: ", error);
  }
}
main();
