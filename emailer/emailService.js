function prepareEmail(applicant) {
    let subject;
    let message;

    if (applicant.status === "shortlisted") {
        subject = "You've been shortlisted!";
        message = `Hi ${applicant.name}, please select your interview slot.`;
    } else if (applicant.status === "not shortlisted") {
        subject = "Application update";
        message = `Hi ${applicant.name}, thank you for applying. You're still part of our club!`;
    } else {
        return null;
    }

    return {
        to: applicant.email,
        subject,
        message
    };
}

module.exports = { prepareEmail };