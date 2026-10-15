
const { sendEmail } = require("./mailer");

async function main() {
  const testEmail = {
    to: process.env.EMAIL_USER,
    subject: "Club Mailer - Test Email",
    message: "Success! Your Node.js emailer can send emails."
  };

  try {
    const result = await sendEmail(testEmail);
    console.log("Test email sent successfully!");
    console.log("Message ID:", result.messageId);
  } catch (error) {
    console.error("Failed to send test email:");
    console.error(error.message);
  }
}

require("dotenv").config();
main();
