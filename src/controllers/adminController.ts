import { Request, Response } from 'express';
import { PrismaClient, DomainType, Role } from '@prisma/client'; 
import { changeStage } from '../utils/adminRules'; 
import { CustomRequest } from '../middleware/authMiddleware';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
//import { sendStageEmail } from '../services/emailService';

const prisma = new PrismaClient();

// 1. Fetch all applicants 
export const getAllApplicants = async (req: Request, res: Response) => {
  try {
    const { domain } = req.query;
    
    const applications = await prisma.application.findMany({
      where: domain ? { domain: String(domain) as DomainType } : undefined, 
      include: {
        user: true 
      },
      orderBy: { user: { regNumber: 'asc' } },
    });
    
    return res.status(200).json({ success: true, data: applications });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
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
          include: { question: true } 
        }
      }
    });

    if (!applicant) return res.status(404).json({ success: false, message: 'Applicant not found' });
    return res.status(200).json({ success: true, data: applicant });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 3. Update an applicant's evaluation notes and stage 
export const updateApplicantReview = async (req: CustomRequest, res: Response) => {
  try {
    const { applicationId } = req.params; 
    const { 
      stage, 
      review1Marks, review1Comments, review1Passed, 
      review2Marks, review2Comments, review2Passed 
    } = req.body;

    const admin = req.user; 

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // 1. Update the application stage 
    if (stage) {
      await changeStage(String(applicationId), stage, admin as any);
    }

    // 2. Update the evaluation notes directly
    const updatedApplication = await prisma.application.update({
      where: { id: String(applicationId) },
      data: { 
        review1Marks, review1Comments, review1Passed, 
        review2Marks, review2Comments, review2Passed 
      },
      include: { user: true }
    });

    return res.status(200).json({ success: true, data: updatedApplication });
  } catch (error: any) {
    // Return the specific HttpError message if a rule is violated 
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || 'Server error' });
  }
};

// 4. Create Interview Slots 
export const createInterviewSlots = async (req: Request, res: Response) => {
  try {
    const { interviewerId, domain, meetingLink, timeBlocks } = req.body; 

    const slotsToCreate = timeBlocks.map((block: any) => ({
      interviewerId: String(interviewerId),
      domain: domain as DomainType, // Cast to Enum
      meetingLink,
      startTime: new Date(block.startTime),
      endTime: new Date(block.endTime),
    }));

    const createdSlots = await prisma.slot.createMany({
      data: slotsToCreate,
    });

    return res.status(201).json({ success: true, message: `${createdSlots.count} slots created` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error while creating slots' });
  }
};

// 5. Get My Schedule 
export const getMySchedule = async (req: Request, res: Response) => {
  try {
    const { adminId } = req.params;

    const mySchedule = await prisma.slot.findMany({
      where: { 
        interviewerId: String(adminId),
        bookedCount: { gt: 0 }
      },
      include: {
        bookings: { 
          include: {
            application: {
              include: {
                user: true 
              }
            }
          }
        }
      },
      orderBy: { startTime: 'asc' } 
    });

    return res.status(200).json({ success: true, data: mySchedule });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error fetching schedule' });
  }
};

// 6. Assign Domain Heads without setting a password yet
export const assignDomainHead = async (req: Request, res: Response) => {
  try {
    const { emails, domain } = req.body; 

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of emails.' });
    }

    const existingAdmins = await prisma.admin.findMany({
      where: { email: { in: emails } }
    });

    if (existingAdmins.length > 0) {
      const duplicateEmails = existingAdmins.map(admin => admin.email);
      return res.status(400).json({ 
        success: false, 
        message: `These emails already have admin accounts: ${duplicateEmails.join(', ')}` 
      });
    }

    const adminsToCreate = emails.map((email: string) => ({
      email: String(email),
      role: "DOMAIN_HEAD" as Role, 
      domain: domain as DomainType 
    }));

    const createdAdmins = await prisma.admin.createMany({
      data: adminsToCreate,
    });

    return res.status(201).json({
      success: true,
      message: `Successfully granted domain access to ${createdAdmins.count} head(s).`,
      assignedEmails: emails
    });
  } catch (error) { 
    return res.status(500).json({ success: false, message: 'Server error while assigning domain heads' });
  }
};

// 7. Create a Form Subsection 
export const createSubsection = async (req: Request, res: Response) => {
  try {
    const { name, domain, order } = req.body; 

    const subsection = await prisma.subsection.create({
      data: { 
        name, 
        domain: domain as DomainType, 
        order: order || 0 
      }
    });

    return res.status(201).json({ success: true, data: subsection });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error while creating subsection' });
  }
};

// 8. Create a Question inside a Subsection
export const createQuestion = async (req: Request, res: Response) => {
  try {
    const { text, domain, subsectionId, required, order, maxLength } = req.body;

    const question = await prisma.question.create({
      data: {
        text,
        domain: domain as DomainType, // Cast to Enum
        subsectionId: subsectionId ? String(subsectionId) : null,
        required: required !== undefined ? required : true,
        order: order || 0,
        maxLength: maxLength || 2000
      }
    });

    return res.status(201).json({ success: true, data: question });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error while creating question' });
  }
};

// 9. Setup Create Admin Account for first time only
export const setupAdminAccount = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // 1. Check if the Root Admin has assigned this email
    const admin = await prisma.admin.findUnique({ where: { email: String(email) } });
    if (!admin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access Denied: This email has not been assigned as an admin.' 
      });
    }

    // 2. If a password already exists, block them from overwriting it
    if (admin.password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Account already exists. Please log in instead.' 
      });
    }

    // 3. Hash the new password and save it against their email
    const hashedPassword = await bcrypt.hash(String(password), 10);
    const updatedAdmin = await prisma.admin.update({
      where: { email: String(email) },
      data: { 
        password: hashedPassword,
        ...(name ? { name: String(name) } : {})
      }
    });

    // 4. Generate the JWT token so they are logged in immediately after creating the account
    const token = jwt.sign(
      { id: updatedAdmin.id, email: updatedAdmin.email, role: updatedAdmin.role, domain: updatedAdmin.domain }, 
      process.env.JWT_SECRET || 'fallback_secret', 
      { expiresIn: '12h' }
    );

    return res.status(200).json({ 
      success: true, 
      message: 'Account set up successfully',
      token, 
      role: updatedAdmin.role, 
      domain: updatedAdmin.domain 
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error during account setup' });
  }
};

// 10. Login Admin 
export const loginAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // 1. Find the admin
    const admin = await prisma.admin.findUnique({ where: { email: String(email) } });
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 2. Check if they haven't created their password yet
    if (!admin.password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password not set for this account. Please go to Create Account first.' 
      });
    }

    // 3. Check the password
    const isMatch = await bcrypt.compare(String(password), admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // 4. Generate the JWT token (Make sure to add JWT_SECRET to your .env file)
    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role, domain: admin.domain }, 
      process.env.JWT_SECRET || 'fallback_secret', 
      { expiresIn: '12h' }
    );

    return res.status(200).json({ success: true, token, role: admin.role, domain: admin.domain });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
};