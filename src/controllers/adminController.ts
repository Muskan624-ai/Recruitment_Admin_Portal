import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Fetch all applicants (Users)
export const getAllApplicants = async (req: Request, res: Response) => {
  try {
    const applicants = await prisma.user.findMany({
      orderBy: { registrationNumber: 'asc' },
    });
    return res.status(200).json({ success: true, data: applicants });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 2. Fetch a single applicant's full details
export const getApplicantById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const applicant = await prisma.user.findUnique({ where: { id: String(id) } });

    if (!applicant) return res.status(404).json({ success: false, message: 'Applicant not found' });
    return res.status(200).json({ success: true, data: applicant });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 3. Update an applicant's evaluation notes and stage
export const updateApplicantReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      stage, 
      review1Marks, review1Comments, review1Passed, 
      review2Marks, review2Comments, review2Passed 
    } = req.body;

    const updatedApplicant = await prisma.user.update({
      where: { id: String(id) },
      data: { 
        stage, review1Marks, review1Comments, review1Passed, review2Marks, review2Comments, review2Passed 
      },
    });
    return res.status(200).json({ success: true, data: updatedApplicant });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 4. Create Interview Slots (Domain Head creates their availability)
export const createInterviewSlots = async (req: Request, res: Response) => {
  try {
    const { interviewerId, meetingLink, timeBlocks } = req.body; 

    const slotsToCreate = timeBlocks.map((block: any) => ({
      interviewerId,
      meetingLink,
      startTime: new Date(block.startTime),
      endTime: new Date(block.endTime),
    }));

    const createdSlots = await prisma.slot.createMany({
      data: slotsToCreate,
    });

    return res.status(201).json({ success: true, message: `${createdSlots.count} slots created` });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Server error while creating slots' });
  }
};

// 5. Get My Schedule (Domain Head checks who booked them)
export const getMySchedule = async (req: Request, res: Response) => {
  try {
    const { adminId } = req.params;

    const mySchedule = await prisma.slot.findMany({
      where: { 
        interviewerId: String(adminId),
        isBooked: true 
      },
      include: {
        user: true 
      },
      orderBy: { startTime: 'asc' } 
    });

    return res.status(200).json({ success: true, data: mySchedule });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error fetching schedule' });
  }
};