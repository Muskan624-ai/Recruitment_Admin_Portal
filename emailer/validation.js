
function isValidApplicant(applicant) {
    if (!applicant || typeof applicant !== "object" || Array.isArray(applicant)) {
        return false;
    }

    if (typeof applicant.name !== "string" || applicant.name.trim() === "") {
        return false;
    }

    if (
        typeof applicant.email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant.email)
    ) {
        return false;
    }

    if (
        applicant.status !== "shortlisted" &&
        applicant.status !== "not shortlisted"
    ) {
        return false;
    }

    return true;
}

module.exports = { isValidApplicant };
