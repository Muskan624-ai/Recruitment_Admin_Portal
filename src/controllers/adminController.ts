import { Request, Response } from 'express';
import { PrismaClient, DomainType, Role } from '@prisma/client'; 
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
export const updateApplicantReview = async (req: Request, res: Response) => {
  try {
    const { applicationId } = req.params; 
    const { 
      stage, 
      review1Marks, review1Comments, review1Passed, 
      review2Marks, review2Comments, review2Passed 
    } = req.body;

    const updatedApplication = await prisma.application.update({
      where: { id: String(applicationId) },
      data: { 
        stage, review1Marks, review1Comments, review1Passed, review2Marks, review2Comments, review2Passed 
      },
      include: { user: true } 
    });

    return res.status(200).json({ success: true, data: updatedApplication });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
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
        isBooked: true 
      },
      include: {
        application: {
          include: {
            user: true 
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

// 6. Assign Domain Heads 
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