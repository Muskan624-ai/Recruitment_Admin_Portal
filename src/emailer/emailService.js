const { sendEmail } = require("./mailer");
const { validateApplicant } = require("./validation");

/**
 * Prepares the email content (subject, text body, and HTML body)
 * depending on whether the candidate is shortlisted or rejected.
 *
 * @param {Object} applicant
 * @param {string} applicant.name - Candidate name
 * @param {string} applicant.email - Candidate email
 * @param {boolean} [applicant.shortlisted] - True if shortlisted, false if rejected
 * @param {string} [applicant.status] - Legacy status string
 * @returns {Object|null} Email configuration object or null if invalid
 */
function prepareEmail(applicant) {
    if (!applicant || typeof applicant !== "object") {
        return null;
    }

    let isShortlisted;
    if (typeof applicant.shortlisted === "boolean") {
        isShortlisted = applicant.shortlisted;
    } else if (applicant.status === "shortlisted") {
        isShortlisted = true;
    } else if (applicant.status === "not shortlisted") {
        isShortlisted = false;
    } else {
        return null;
    }

    const candidateName = (applicant.name || "Candidate").trim();

    let subject;
    let message;
    let html;

    if (isShortlisted) {
        subject = "Recruitment Update: Shortlisted for Interview";
        message = `Dear ${candidateName},

Congratulations! We are pleased to inform you that you have been shortlisted for the next stage of our recruitment process.

We were very impressed by your application and profile. The next step in our process is an interview round with our domain leads. Please log in to your candidate recruitment portal at your earliest convenience to select your preferred interview slot.

If you have any questions or require accommodations, feel free to reply directly to this email.

Best regards,
Recruitment Team`;

        html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 20px; background-color: #f7fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
    <tr>
      <td style="background-color: #2b6cb0; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 22px;">Recruitment Portal</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 28px 24px;">
        <h2 style="color: #2b6cb0; margin-top: 0;">Congratulations, ${candidateName}!</h2>
        <p>We are delighted to inform you that you have been <strong>shortlisted</strong> for the next round of our recruitment process.</p>
        <p>Our review team was thoroughly impressed by your profile, answers, and technical enthusiasm.</p>
        
        <div style="background-color: #ebf8ff; border-left: 4px solid #3182ce; padding: 16px; margin: 24px 0; border-radius: 4px;">
          <p style="margin: 0; font-weight: bold; color: #2b6cb0;">Next Step: Select Your Interview Slot</p>
          <p style="margin: 8px 0 0 0; color: #2d3748;">Please log in to your candidate portal as soon as possible to reserve your preferred 10-minute interview block with our interviewers.</p>
        </div>

        <p>If you experience any difficulties or have questions, please reach out to our team by replying to this email.</p>
        
        <p style="margin-top: 32px; margin-bottom: 4px;">Best regards,</p>
        <p style="margin: 0; font-weight: bold; color: #4a5568;">The Recruitment Team</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #edf2f7; padding: 16px; text-align: center; font-size: 12px; color: #718096;">
        This is an official communication from the Recruitment Team.
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
    } else {
        subject = "Recruitment Application Update";
        message = `Dear ${candidateName},

Thank you for your interest and for taking the time to apply for our recruitment drive.

We received a large number of impressive applications this season. After comprehensive review, we regret to inform you that we will not be moving forward with your candidacy for this round.

Please know that our decision was difficult and competitive, and is in no way a reflection of your worth or potential. We genuinely appreciate the effort you put into your application, and you remain a valued member of our student and club community. We warmly encourage you to apply again during our future recruitment cycles.

We wish you all the very best in your academic and professional endeavors.

Warm regards,
Recruitment Team`;

        html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 20px; background-color: #f7fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
    <tr>
      <td style="background-color: #4a5568; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 22px;">Recruitment Portal</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 28px 24px;">
        <h2 style="color: #4a5568; margin-top: 0;">Application Update</h2>
        <p>Dear ${candidateName},</p>
        <p>Thank you for taking the time and effort to apply for our recruitment drive.</p>
        <p>We received an exceptionally high volume of applications this cycle. After careful consideration by our evaluation panel, we regret to inform you that we are unable to advance your application to the interview stage at this time.</p>
        <p>This was a very competitive process, and this outcome is not a reflection of your skills or future potential. We sincerely value your enthusiasm, and you remain an integral part of our community. We strongly encourage you to reapply in future recruitment cycles.</p>
        
        <p>We wish you continued success in all your academic and career pursuits.</p>
        
        <p style="margin-top: 32px; margin-bottom: 4px;">Warm regards,</p>
        <p style="margin: 0; font-weight: bold; color: #4a5568;">The Recruitment Team</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #edf2f7; padding: 16px; text-align: center; font-size: 12px; color: #718096;">
        This is an official communication from the Recruitment Team.
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
    }

    return {
        to: applicant.email,
        subject,
        message,
        html,
        shortlisted: isShortlisted
    };
}

/**
 * Validates, prepares, and sends a shortlist or polite rejection email.
 *
 * @param {Object} applicant - Candidate details
 * @param {string} applicant.name - Candidate full name
 * @param {string} applicant.email - Candidate email address
 * @param {boolean} applicant.shortlisted - true for interview invite, false for polite rejection
 * @param {Object} [customTransporter] - Optional custom transporter (e.g. for testing)
 * @returns {Promise<{ success: boolean, recipient: string, shortlisted: boolean, messageId: string, emailData: Object, info: Object }>}
 */
async function sendShortlistEmail(applicant, customTransporter = null) {
    const validation = validateApplicant(applicant);
    if (!validation.isValid) {
        throw new Error(`Validation Error: ${validation.error}`);
    }

    const emailData = prepareEmail(applicant);
    if (!emailData) {
        throw new Error("Unable to prepare email: invalid applicant status or data.");
    }

    const info = await sendEmail(emailData, customTransporter);

    const isShortlisted = typeof applicant.shortlisted === "boolean"
        ? applicant.shortlisted
        : (applicant.status === "shortlisted");

    return {
        success: true,
        recipient: applicant.email,
        shortlisted: isShortlisted,
        messageId: info?.messageId || "sent"
    };
}

module.exports = {
    prepareEmail,
    sendShortlistEmail
};
