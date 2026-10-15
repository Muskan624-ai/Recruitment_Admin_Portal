
require("dotenv").config();

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

async function sendEmail(email) {
    return transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email.to,
        subject: email.subject,
        text: email.message
    });
}

module.exports = { sendEmail, transporter };
