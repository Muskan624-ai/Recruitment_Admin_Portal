import { Request, Response } from 'express';
import { PrismaClient, DomainType, Role, Stage } from '@prisma/client';
import { changeStage } from '../utils/adminRules';
import { CustomRequest } from '../middleware/authMiddleware';
import { sendShortlistEmail } from '../emailer';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Helper delay to respect Gmail rate limits during batch sends
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 1. Fetch all submitted applicants
export const getAllApplicants = async (req: CustomRequest, res: Response) => {
  try {
    const queryDomain = req.query.domain as string | undefined;
    const admin = req.user as any;

    const effectiveDomain =
      admin?.role === 'DOMAIN_HEAD' && admin?.domain
        ? (admin.domain as DomainType)
        : queryDomain && queryDomain !== 'ALL'
        ? (queryDomain as DomainType)
        : undefined;

    const applications = await prisma.application.findMany({
      where: {
        ...(effectiveDomain ? { domain: effectiveDomain } : {}),
        submittedAt: { not: null },
      },
      include: {
        user: {
          include: {
            answers: {
              include: { question: true },
            },
          },
        },
        booking: {
          include: {
            slot: {
              include: {
                interviewer: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
        },
        emails: true,
      },
      orderBy: { user: { regNumber: 'asc' } },
    });

    return res.status(200).json({ success: true, data: applications });
  } catch (error) {
    console.error('getAllApplicants failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching applicants',
    });
  }
};

// 2. Fetch a single applicant's full details
export const getApplicantById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const applicant = await prisma.user.findUnique({
      where: { id: String(id) },
      include: {
        applications: true,
        answers: {
          include: { question: true },
        },
      },
    });

    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: 'Applicant not found',
      });
    }

    return res.status(200).json({ success: true, data: applicant });
  } catch (error) {
    console.error('getApplicantById failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// 3. Update applicant review (Review 1 & Review 2 Toggles + Marks)
export const updateApplicantReview = async (req: CustomRequest, res: Response) => {
  try {
    const { applicationId } = req.params;
    const {
      stage,
      review1Marks,
      review1Comments,
      review1Passed,
      review2Marks,
      review2Comments,
      review2Passed,
      answerScores,
    } = req.body;

    const admin = req.user;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const currentApp = await prisma.application.findUnique({
      where: { id: String(applicationId) },
      include: { booking: true },
    });

    if (!currentApp) {
      return res.status(404).json({
        success: false,
        message: 'Application not found',
      });
    }

    if (Array.isArray(answerScores) && answerScores.length > 0) {
      await Promise.all(
        answerScores.map((item: { answerId: string; marks: number }) =>
          prisma.answer.update({
            where: { id: String(item.answerId) },
            data: { marks: Number(item.marks) || 0 },
          })
        )
      );
    }

    // If stage is explicitly passed (e.g. SELECTED / REJECTED toggle in Review 2),
    // update stage directly if the candidate has a booked slot so we don't accidentally
    // delete their SlotBooking and make them disappear from Review 2!
    if (stage && stage !== currentApp.stage) {
      if (currentApp.booking && (stage === 'SELECTED' || stage === 'REJECTED')) {
        await prisma.application.update({
          where: { id: String(applicationId) },
          data: { stage: stage as Stage },
        });
      } else {
        try {
          await changeStage(String(applicationId), stage as Stage, admin as any);
        } catch {
          await prisma.application.update({
            where: { id: String(applicationId) },
            data: { stage: stage as Stage },
          });
        }
      }
    }

    const updatedApplication = await prisma.application.update({
      where: { id: String(applicationId) },
      data: {
        ...(review1Marks !== undefined
          ? { review1Marks: Number(review1Marks) }
          : {}),
        ...(review1Comments !== undefined
          ? { review1Comments }
          : {}),
        ...(review1Passed !== undefined
          ? { review1Passed: Boolean(review1Passed) }
          : {}),
        ...(review2Marks !== undefined
          ? { review2Marks: Number(review2Marks) }
          : {}),
        ...(review2Comments !== undefined
          ? { review2Comments }
          : {}),
        ...(review2Passed !== undefined
          ? { review2Passed: Boolean(review2Passed) }
          : {}),
      },
      include: {
        user: {
          include: {
            answers: {
              include: { question: true },
            },
          },
        },
        booking: {
          include: {
            slot: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: updatedApplication,
    });
  } catch (error: any) {
    console.error('updateApplicantReview failed:', error);
    const status = error.status || 500;

    return res.status(status).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// 3B. Batch Release Shortlist & Send Real Emails via src/emailer/index.js
export const releaseShortlistBatch = async (req: CustomRequest, res: Response) => {
  try {
    const admin = req.user as any;
    const { domain } = req.body;

    const effectiveDomain =
      admin?.role === 'DOMAIN_HEAD' && admin?.domain
        ? (admin.domain as DomainType)
        : domain && domain !== 'ALL'
        ? (domain as DomainType)
        : undefined;

    if (!effectiveDomain) {
      return res.status(400).json({
        success: false,
        message: 'Please select a specific domain to release the shortlist.',
      });
    }

    const apps = await prisma.application.findMany({
      where: {
        domain: effectiveDomain,
        submittedAt: { not: null },
      },
      include: {
        user: true,
        emails: true,
      },
    });

    // Candidates toggled ON (review1Passed === true)
    const shortlistedApps = apps.filter(
      (a) => a.review1Passed === true && a.stage !== 'INTERVIEW' && a.stage !== 'SELECTED'
    );

    // Candidates toggled OFF who have been graded (review1Marks !== null)
    const rejectedApps = apps.filter(
      (a) =>
        a.review1Passed === false &&
        a.review1Marks !== null &&
        a.stage !== 'INTERVIEW' &&
        a.stage !== 'SELECTED'
    );

    let shortlistEmailsSent = 0;
    let rejectionEmailsSent = 0;
    let emailFailures = 0;

    // 1. Process Shortlisted Candidates -> Move to SLOT_CHOOSING & Send Shortlist Email
    for (const app of shortlistedApps) {
      if (app.stage !== 'SLOT_CHOOSING') {
        await prisma.application.update({
          where: { id: app.id },
          data: { stage: 'SLOT_CHOOSING' },
        });
      }

      const alreadySent = app.emails?.some(
        (e) => e.type === 'SHORTLISTED' && e.status === 'SENT'
      );

      if (!alreadySent && app.user?.email) {
        try {
          await sendShortlistEmail({
            name: app.user.name || 'Candidate',
            email: app.user.email,
            shortlisted: true,
          });

          await prisma.emailLog.create({
            data: {
              applicationId: app.id,
              type: 'SHORTLISTED',
              status: 'SENT',
              attempts: 1,
              sentAt: new Date(),
            },
          });
          shortlistEmailsSent++;
          await sleep(600);
        } catch (err: any) {
          console.error(`Failed to send shortlist email to ${app.user.email}:`, err.message);
          await prisma.emailLog.create({
            data: {
              applicationId: app.id,
              type: 'SHORTLISTED',
              status: 'FAILED',
              attempts: 1,
              error: err.message,
            },
          });
          emailFailures++;
        }
      }
    }

    // 2. Process Non-Shortlisted Graded Candidates -> Move to REJECTED & Send Polite Rejection Email
    for (const app of rejectedApps) {
      if (app.stage !== 'REJECTED') {
        await prisma.application.update({
          where: { id: app.id },
          data: { stage: 'REJECTED' },
        });
      }

      const alreadySent = app.emails?.some(
        (e) => e.type === 'REJECTED' && e.status === 'SENT'
      );

      if (!alreadySent && app.user?.email) {
        try {
          await sendShortlistEmail({
            name: app.user.name || 'Candidate',
            email: app.user.email,
            shortlisted: false,
          });

          await prisma.emailLog.create({
            data: {
              applicationId: app.id,
              type: 'REJECTED',
              status: 'SENT',
              attempts: 1,
              sentAt: new Date(),
            },
          });
          rejectionEmailsSent++;
          await sleep(600);
        } catch (err: any) {
          console.error(`Failed to send rejection email to ${app.user.email}:`, err.message);
          await prisma.emailLog.create({
            data: {
              applicationId: app.id,
              type: 'REJECTED',
              status: 'FAILED',
              attempts: 1,
              error: err.message,
            },
          });
          emailFailures++;
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Batch complete! ${shortlistedApps.length} moved to Slot Choosing (${shortlistEmailsSent} invite emails sent), ${rejectedApps.length} rejected (${rejectionEmailsSent} rejection emails sent)${
        emailFailures > 0 ? ` — ${emailFailures} email(s) failed (check EMAIL_USER/EMAIL_APP_PASSWORD in .env)` : ''
      }.`,
    });
  } catch (error: any) {
    console.error('releaseShortlistBatch failed:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error releasing shortlist batch',
    });
  }
};

// 4. Create Interview Slots
export const createInterviewSlots = async (req: CustomRequest, res: Response) => {
  try {
    const admin = req.user as any;

    const {
      interviewerId,
      domain,
      meetingLink,
      startTime,
      endTime,
      durationMinutes,
      capacity,
    } = req.body;

    const effectiveInterviewerId = interviewerId || admin?.id;
    const effectiveDomain = (domain || admin?.domain) as DomainType;

    if (!effectiveInterviewerId || !effectiveDomain) {
      return res.status(400).json({
        success: false,
        message: 'Missing interviewer or domain information.',
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after start time.',
      });
    }

    const totalRangeMinutes = Math.round(
      (end.getTime() - start.getTime()) / 60000
    );

    const slotDuration =
      Number(durationMinutes) > 0
        ? Number(durationMinutes)
        : totalRangeMinutes;

    const slotsToCreate = [];
    let currentStart = new Date(start);

    while (currentStart < end) {
      const currentEnd = new Date(
        currentStart.getTime() + slotDuration * 60000
      );

      if (currentEnd > end) break;

      slotsToCreate.push({
        interviewerId: String(effectiveInterviewerId),
        domain: effectiveDomain,
        meetingLink: meetingLink ? String(meetingLink).trim() : null,
        startTime: new Date(currentStart),
        endTime: new Date(currentEnd),
        capacity: Number(capacity) > 0 ? Number(capacity) : 1,
      });

      currentStart = currentEnd;
    }

    if (slotsToCreate.length === 0) {
      return res.status(400).json({
        success: false,
        message: `Time window (${totalRangeMinutes} mins) is shorter than the selected slot duration (${slotDuration} mins).`,
      });
    }

    const createdSlots = await prisma.slot.createMany({
      data: slotsToCreate,
    });

    return res.status(201).json({
      success: true,
      message: `Successfully created ${createdSlots.count} interview slot(s) (${slotDuration} mins each)!`,
    });
  } catch (error) {
    console.error('createInterviewSlots failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating slots',
    });
  }
};

// 5. Get My Schedule
export const getMySchedule = async (req: CustomRequest, res: Response) => {
  try {
    const { adminId } = req.params;
    const { all, domain } = req.query;

    const mySchedule = await prisma.slot.findMany({
      where: {
        ...(adminId && adminId !== 'ALL'
          ? { interviewerId: String(adminId) }
          : {}),
        ...(domain && domain !== 'ALL'
          ? { domain: String(domain) as DomainType }
          : {}),
        ...(all === 'true' ? {} : { bookedCount: { gt: 0 } }),
      },
      include: {
        bookings: {
          include: {
            application: {
              include: {
                user: true,
              },
            },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: mySchedule,
    });
  } catch (error) {
    console.error('getMySchedule failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching schedule',
    });
  }
};

// 5B. Delete an Interview Slot
export const deleteInterviewSlot = async (req: CustomRequest, res: Response) => {
  try {
    const { id } = req.params;
    const admin = req.user as any;

    const slot = await prisma.slot.findUnique({
      where: { id: String(id) },
      include: { bookings: true },
    });

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Slot not found.',
      });
    }

    if (admin?.role !== 'ROOT_ADMIN' && slot.interviewerId !== admin?.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete slots that you created.',
      });
    }

    if (slot.bookings.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete this slot because a candidate has already booked it.',
      });
    }

    await prisma.slot.delete({
      where: { id: String(id) },
    });

    return res.status(200).json({
      success: true,
      message: 'Slot deleted successfully.',
    });
  } catch (error) {
    console.error('deleteInterviewSlot failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting slot.',
    });
  }
};

// 6A. Get All Whitelisted Domain Heads
export const getDomainHeads = async (req: Request, res: Response) => {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: { email: 'asc' },
    });
    const formatted = admins.map((a) => ({
      id: a.id,
      email: a.email,
      name: a.name,
      role: a.role,
      domain: a.domain,
      hasPassword: Boolean(a.password),
    }));
    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('getDomainHeads failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch domain heads',
    });
  }
};

// 6B. Assign or Update Domain Heads
export const assignDomainHead = async (req: Request, res: Response) => {
  try {
    const { emails, email, domain } = req.body;

    const rawList = Array.isArray(emails)
      ? emails
      : typeof emails === 'string'
      ? emails.split(',')
      : typeof email === 'string'
      ? email.split(',')
      : [];

    const normalizedEmails = rawList
      .map((e: string) => String(e).trim().toLowerCase())
      .filter(Boolean);

    if (normalizedEmails.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one valid email.',
      });
    }

    const allAdmins = await prisma.admin.findMany();

    let createdCount = 0;
    let updatedCount = 0;

    for (const em of normalizedEmails) {
      const existing = allAdmins.find(
        (a) => a.email.trim().toLowerCase() === em
      );

      if (existing) {
        await prisma.admin.update({
          where: { id: existing.id },
          data: {
            email: em,
            domain: domain as DomainType,
          },
        });
        updatedCount++;
      } else {
        await prisma.admin.create({
          data: {
            email: em,
            role: 'DOMAIN_HEAD' as Role,
            domain: domain as DomainType,
          },
        });
        createdCount++;
      }
    }

    return res.status(201).json({
      success: true,
      message: `Successfully whitelisted ${createdCount} new and updated ${updatedCount} existing Domain Head(s) for ${domain}.`,
      assignedEmails: normalizedEmails,
    });
  } catch (error) {
    console.error('assignDomainHead failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while assigning domain heads',
    });
  }
};

// 7. Get Domain Form Questions & Subsections (Strict Domain Priority)
export const getDomainForm = async (req: CustomRequest, res: Response) => {
  try {
    const admin = req.user as any;
    const queryDomain = req.query.domain as string | undefined;

    const effectiveDomain =
      queryDomain && queryDomain !== 'ALL'
        ? (queryDomain as DomainType)
        : admin?.domain
        ? (admin.domain as DomainType)
        : undefined;

    const [subsections, questions] = await Promise.all([
      prisma.subsection.findMany({
        where: effectiveDomain ? { domain: effectiveDomain } : undefined,
        orderBy: { order: 'asc' },
      }),
      prisma.question.findMany({
        where: effectiveDomain ? { domain: effectiveDomain } : undefined,
        include: { subsection: true },
        orderBy: { order: 'asc' },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: { subsections, questions },
    });
  } catch (error) {
    console.error('getDomainForm failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching domain form',
    });
  }
};

// 8. Create a Form Subsection
export const createSubsection = async (req: CustomRequest, res: Response) => {
  try {
    const admin = req.user as any;
    const { name, domain, order } = req.body;

    const effectiveDomain = (
      domain || admin?.domain
    ) as DomainType;

    if (!name || !effectiveDomain) {
      return res.status(400).json({
        success: false,
        message: 'Subsection name and domain are required.',
      });
    }

    const subsection = await prisma.subsection.create({
      data: {
        name: String(name).trim(),
        domain: effectiveDomain,
        order: Number(order) || 0,
      },
    });

    return res.status(201).json({
      success: true,
      data: subsection,
    });
  } catch (error) {
    console.error('createSubsection failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating subsection',
    });
  }
};

// 9A. Create a Question
export const createQuestion = async (req: CustomRequest, res: Response) => {
  try {
    const admin = req.user as any;
    const {
      text,
      domain,
      subsectionId,
      required,
      order,
      maxLength,
      maxMarks,
    } = req.body;

    const effectiveDomain = (
      domain || admin?.domain
    ) as DomainType;

    if (!text || !effectiveDomain) {
      return res.status(400).json({
        success: false,
        message: 'Question text and domain are required.',
      });
    }

    let validSubsectionId: string | null = null;

    if (subsectionId) {
      const subsection = await prisma.subsection.findUnique({
        where: { id: String(subsectionId) },
      });

      if (!subsection) {
        return res.status(400).json({
          success: false,
          message: 'The selected subsection does not exist.',
        });
      }

      if (subsection.domain !== effectiveDomain) {
        return res.status(400).json({
          success: false,
          message: 'The selected subsection does not belong to this domain.',
        });
      }

      validSubsectionId = subsection.id;
    }

    const question = await prisma.question.create({
      data: {
        text: String(text).trim(),
        domain: effectiveDomain,
        subsectionId: validSubsectionId,
        required: required !== undefined ? Boolean(required) : true,
        order: Number(order) || 0,
        maxLength: Number(maxLength) || 2000,
        maxMarks: Number(maxMarks) || 10,
      },
    });

    return res.status(201).json({
      success: true,
      data: question,
    });
  } catch (error) {
    console.error('createQuestion failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating question',
    });
  }
};

// 9B. Edit / Update an Existing Question
export const updateQuestion = async (req: CustomRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { text, maxMarks, order, subsectionId, required } = req.body;

    const existing = await prisma.question.findUnique({
      where: { id: String(id) },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Question not found.',
      });
    }

    const updated = await prisma.question.update({
      where: { id: String(id) },
      data: {
        ...(text !== undefined ? { text: String(text).trim() } : {}),
        ...(maxMarks !== undefined ? { maxMarks: Number(maxMarks) || 10 } : {}),
        ...(order !== undefined ? { order: Number(order) || 0 } : {}),
        ...(subsectionId !== undefined
          ? { subsectionId: subsectionId ? String(subsectionId) : null }
          : {}),
        ...(required !== undefined ? { required: Boolean(required) } : {}),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Question updated successfully!',
      data: updated,
    });
  } catch (error) {
    console.error('updateQuestion failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating question',
    });
  }
};

// 9C. Delete a Question
export const deleteQuestion = async (req: CustomRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.question.delete({
      where: { id: String(id) },
    });
    return res.status(200).json({
      success: true,
      message: 'Question deleted successfully!',
    });
  } catch (error) {
    console.error('deleteQuestion failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting question',
    });
  }
};

// 10. Setup Admin Account
export const setupAdminAccount = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const allMatching = await prisma.admin.findMany();
    const admin = allMatching.find(
      (a) => a.email.trim().toLowerCase() === normalizedEmail
    );

    if (!admin) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: This email has not been whitelisted by the Root Admin yet.',
      });
    }

    if (admin.password) {
      return res.status(400).json({
        success: false,
        message: 'Password is already set for this account. Please click Login instead.',
      });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);

    const updatedAdmin = await prisma.admin.update({
      where: { id: admin.id },
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        ...(name ? { name: String(name) } : {}),
      },
    });

    const secret =
      process.env.JWT_SECRET ||
      process.env.ADMIN_JWT_SECRET ||
      'fallback_secret';

    const token = jwt.sign(
      {
        id: updatedAdmin.id,
        email: updatedAdmin.email,
        role: updatedAdmin.role,
        domain: updatedAdmin.domain,
      },
      secret,
      { expiresIn: '12h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Password created & logged in successfully!',
      token,
      id: updatedAdmin.id,
      email: updatedAdmin.email,
      role: updatedAdmin.role,
      domain: updatedAdmin.domain,
    });
  } catch (error) {
    console.error('setupAdminAccount failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during admin setup',
    });
  }
};

// 11. Login Admin
export const loginAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const allMatching = await prisma.admin.findMany();
    const admin = allMatching.find(
      (a) => a.email.trim().toLowerCase() === normalizedEmail
    );

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'This email is not registered as an Admin or Domain Head.',
      });
    }

    if (!admin.password) {
      return res.status(400).json({
        success: false,
        message: 'First-time login detected! Please click "Create First-Time Password" below to set your password.',
      });
    }

    const isMatch = await bcrypt.compare(
      String(password),
      admin.password
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password. Please try again.',
      });
    }

    const secret =
      process.env.JWT_SECRET ||
      process.env.ADMIN_JWT_SECRET ||
      'fallback_secret';

    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        domain: admin.domain,
      },
      secret,
      { expiresIn: '12h' }
    );

    return res.status(200).json({
      success: true,
      token,
      id: admin.id,
      email: admin.email,
      role: admin.role,
      domain: admin.domain,
    });
  } catch (error) {
    console.error('loginAdmin failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
};