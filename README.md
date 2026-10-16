# Recruitment_Admin_Portal

This repository contains the backend architecture and API routes for the Admin/Domain Head side of the Recruitment Portal. It operates in accordance with the Candidate Backend, sharing a unified MongoDB database to seamlessly manage fresher applications, multi-stage evaluations and interview scheduling.

## Tech Stack
* **Runtime:** Node.js
* **Framework:** Express.js
* **ORM:** Prisma
* **Database:** MongoDB

## Current Architecture & Shared Schema
The database architecture has been synchronized with the Candidate backend to ensure seamless data flow. Key shared models include:
* **Admin:** Stores Root Admins and Domain Heads.
* **User:** Stores candidate form submissions, current stage (`SHORTLISTED`, `INTERVIEW`, etc.), and dedicated Admin review fields (`review1Marks`, `review1Comments`, `review1Passed`, `review2Marks`, `review2Comments`, `review2Passed`).
* **Slot:** Acts as the scheduling bridge, storing 10-minute time blocks, the interviewer's ID, the assigned candidate's ID, and the permanent meeting link.

## Progress & Implemented Features

### 1. Applicant Evaluation Logic (`adminController.ts`)
* **`getAllApplicants`**: Fetches the complete list of candidates for the main admin dashboard.
* **`getApplicantById`**: Retrieves a specific candidate's full profile, responses, and evaluation history.
* **`updateApplicantReview`**: Allows admins to save marks, comments, and toggle outcomes for Review 1 and Review 2, updating the candidate's data in real-time.

### 2. Interview Scheduling Pipeline
* **`createInterviewSlots`**: Allows Domain Heads to bulk-generate availability blocks and embed their permanent Google Meet/Zoom links directly into the database slots. When candidates book via the frontend, the meeting link is instantly available to them.
* **`getMySchedule`**: Fetches a chronologically sorted list of successfully booked interview slots for the logged-in Domain Head, complete with the assigned candidate's details.

### 3. API Routing (`adminRoutes.ts`)
Fully configured Express router connecting all frontend endpoints (GET, POST, PUT) to their respective controller logic.

## Next Steps (Upcoming Work)
* Implement Admin Authentication (Login, JWT generation, password hashing).
* Add automated email triggers when a candidate's status changes to `ACCEPTED` or `REJECTED`.
