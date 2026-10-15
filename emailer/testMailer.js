
const { transporter } = require("./mailer");

async function testConnection() {
    try {
        await transporter.verify();
        console.log("Gmail connection verified successfully!");
    } catch (error) {
        console.error("Gmail connection failed:");
        console.error(error.message);
    }
}

testConnection();
