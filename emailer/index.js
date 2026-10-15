const { prepareEmail } = require("./emailService");

const applicants = [
    {
        name: "Rahul",
        email: "rahul@example.com",
        status: "shortlisted"
    },
    {
        name: "Priya",
        email: "priya@example.com",
        status: "not shortlisted"
    },
    {
        name: "Aman",
        email: "aman@example.com",
        status: "pending"
    }
];

for (const applicant of applicants) {
    const email = prepareEmail(applicant);

    if (email === null) {
        console.log(`Skipping ${applicant.name}: invalid status`);
        continue;
    }

    console.log(email);
    console.log("--------------------");
}