import { Router } from 'express';
import { 
  getAllApplicants, 
  getApplicantById, 
  updateApplicantReview,
  createInterviewSlots,
  getMySchedule,
  assignDomainHead
} from '../controllers/adminController';

const router = Router();

// --- APPLICANT REVIEW ROUTES ---
router.get('/applicants', getAllApplicants);
router.get('/applicants/:id', getApplicantById);
router.put('/applicants/:id/review', updateApplicantReview);

// --- SCHEDULING ROUTES ---
router.post('/slots', createInterviewSlots);
router.get('/schedule/:adminId', getMySchedule);
router.post('/domain-heads', assignDomainHead);

export default router;