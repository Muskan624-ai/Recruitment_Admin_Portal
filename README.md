# Recruitment_Admin_Portal

This repository contains the backend architecture and API routes for the Admin/Domain Head side of the Recruitment Portal. It operates in accordance with the Candidate Backend, sharing a unified MongoDB database to seamlessly manage fresher applications, multi-stage evaluations, and interview scheduling.

## Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **ORM:** Prisma
- **Database:** MongoDB
- **Security & Auth:** bcrypt, jsonwebtoken (JWT)

## Current Architecture & Shared Schema
The database architecture has been synchronized with the Candidate backend to ensure seamless data flow. Key shared models include:
- **Admin:** Stores Root Admins and Domain Heads with secure password hashing (`password String?`) and role-based access control.
- **User:** Stores candidate form submissions, current stage (`SHORTLISTED`, `INTERVIEW`, etc.), and dedicated Admin review fields (`review1Marks`, `review1Comments`, `review1Passed`, `review2Marks`, `review2Comments`, `review2Passed`).
- **Slot:** Acts as the scheduling bridge, storing 10-minute time blocks, the interviewer's ID, the assigned candidate's ID, and the permanent meeting link.

## Progress & Implemented Features

### 1. Admin Authentication & RBAC (`adminController.ts` & `authMiddleware.ts`)
- **`assignDomainHead` (Root Admin):** Allows Root Admins to pre-assign and whitelist Domain Head college emails.
- **`setupAdminAccount` (First-Time Claim):** Enables whitelisted Domain Heads to securely claim their accounts, hash custom passwords via `bcrypt`, and auto-generate session JWTs.
- **`loginAdmin` (Subsequent Logins):** Validates credentials, checks account status, and issues a 12-hour signed JWT.
- **Middleware Security:** Integrated `verifyToken` for Bearer token validation and `authorizeRole` for strict role-based access control (`ROOT_ADMIN` and `DOMAIN_HEAD`).

### 2. Applicant Evaluation Logic (`adminController.ts`)
- **`getAllApplicants`**: Fetches the complete list of candidates for the main admin dashboard.
- **`getApplicantById`**: Retrieves a specific candidate's full profile, responses, and evaluation history.
- **`updateApplicantReview`**: Allows admins to save marks, comments, and toggle outcomes for Review 1 and Review 2 while enforcing teammate security guardrails (`adminRules.ts`).

### 3. Interview Scheduling Pipeline
- **`createInterviewSlots`**: Allows Domain Heads to bulk-generate availability blocks and embed permanent meeting links directly into the database slots.
- **`getMySchedule`**: Fetches a chronologically sorted list of successfully booked interview slots for the logged-in Domain Head, complete with assigned candidate details.

### 4. API Routing (`adminRoutes.ts`)
Fully configured Express router connecting public auth endpoints (`/setup`, `/login`) and protecting operational routes via JWT verification and role checks.

## Next Steps (Upcoming Work)
- Integrate automated email triggers (via Amazon SES) when a candidate's status changes.