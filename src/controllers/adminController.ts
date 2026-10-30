
import { Request, Response } from 'express';
import { PrismaClient, DomainType, Role } from '@prisma/client';
import { changeStage } from '../utils/adminRules';
import { CustomRequest } from '../middleware/authMiddleware';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

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
          include: { slot: true },
        },
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

// 3. Update applicant review
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

    if (stage && stage !== currentApp.stage) {
      await changeStage(String(applicationId), stage, admin as any);
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

// 6. Assign Domain Heads
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

    const existingAdmins = await prisma.admin.findMany({
      where: { email: { in: normalizedEmails } },
    });

    if (existingAdmins.length > 0) {
      const duplicateEmails = existingAdmins.map((admin) => admin.email);

      return res.status(400).json({
        success: false,
        message: `These emails already have admin accounts: ${duplicateEmails.join(', ')}`,
      });
    }

    const adminsToCreate = normalizedEmails.map((em: string) => ({
      email: em,
      role: 'DOMAIN_HEAD' as Role,
      domain: domain as DomainType,
    }));

    const createdAdmins = await prisma.admin.createMany({
      data: adminsToCreate,
    });

    return res.status(201).json({
      success: true,
      message: `Successfully granted domain access to ${createdAdmins.count} head(s).`,
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

// 7. Get Domain Form Questions & Subsections
export const getDomainForm = async (req: CustomRequest, res: Response) => {
  try {
    const admin = req.user as any;
    const queryDomain = req.query.domain as string | undefined;

    const effectiveDomain =
      admin?.role === 'DOMAIN_HEAD' && admin?.domain
        ? (admin.domain as DomainType)
        : queryDomain && queryDomain !== 'ALL'
        ? (queryDomain as DomainType)
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
      admin?.role === 'DOMAIN_HEAD' && admin?.domain
        ? admin.domain
        : domain
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

// 9. Create a Question
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
      admin?.role === 'DOMAIN_HEAD' && admin?.domain
        ? admin.domain
        : domain
    ) as DomainType;

    if (!text || !effectiveDomain) {
      return res.status(400).json({
        success: false,
        message: 'Question text and domain are required.',
      });
    }

    // Verify subsection exists before linking the question to it.
    let validSubsectionId: string | null = null;

    if (subsectionId) {
      const subsection = await prisma.subsection.findUnique({
        where: { id: String(subsectionId) },
      });

      if (!subsection) {
        return res.status(400).json({
          success: false,
          message: 'The selected subsection does not exist. Please refresh and select it again.',
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
    // Temporary diagnostic logging. Do not send raw database errors to clients.
    console.error('createQuestion failed:', error);

    return res.status(500).json({
      success: false,
      message: 'Server error while creating question',
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
        message: 'Access Denied: This email has not been assigned as an admin.',
      });
    }

    if (admin.password) {
      return res.status(400).json({
        success: false,
        message: 'Account already exists. Please log in instead.',
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
      message: 'Account set up successfully',
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
        message: 'Invalid credentials',
      });
    }

    if (!admin.password) {
      return res.status(400).json({
        success: false,
        message: 'Password not set for this account. Please click Create First-Time Password first.',
      });
    }

    const isMatch = await bcrypt.compare(
      String(password),
      admin.password
    );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
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
