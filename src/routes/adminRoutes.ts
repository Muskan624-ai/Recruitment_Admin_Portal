import { Router } from 'express';
import { 
  getAllApplicants, 
  getApplicantById, 
  updateApplicantReview,
  createInterviewSlots,
  getMySchedule
} from '../controllers/adminController';

const router = Router();

// --- APPLICANT REVIEW ROUTES ---
// GET: /api/admin/applicants
router.get('/applicants', getAllApplicants);

// GET: /api/admin/applicants/:id
router.get('/applicants/:id', getApplicantById);

// PUT: /api/admin/applicants/:id/review
router.put('/applicants/:id/review', updateApplicantReview);

// --- SCHEDULING ROUTES ---
// POST: /api/admin/slots
router.post('/slots', createInterviewSlots);

// GET: /api/admin/schedule/:adminId
router.get('/schedule/:adminId', getMySchedule);

export default router;