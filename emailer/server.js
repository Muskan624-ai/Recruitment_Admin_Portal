
const express = require("express");
const { prepareEmail } = require("./emailService");
const { isValidApplicant } = require("./validation");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Club Mailer API is running!");
});

app.post("/prepare-email", (req, res) => {
    const applicant = req.body;

    if (!isValidApplicant(applicant)) {
        return res.status(400).json({
            error: "Invalid applicant data"
        });
    }

    const email = prepareEmail(applicant);

    res.json(email);
});
app.post("/prepare-emails", (req, res) => {
    const applicants = req.body;

    if (!Array.isArray(applicants)) {
        return res.status(400).json({
            error: "Expected an array of applicants"
        });
    }

    const emails = [];

    for (const applicant of applicants) {
        if (!isValidApplicant(applicant)) {
            return res.status(400).json({
                error: `Invalid applicant data for ${applicant?.name || "unknown applicant"}`
            });
        }
        const email = prepareEmail(applicant);

        if (email === null) {
            return res.status(400).json({
                error: `Invalid status for ${applicant.name}`
            });
        }

        emails.push(email);
    }

    res.json(emails);
});

app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});
