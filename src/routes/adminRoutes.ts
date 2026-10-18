import { Router } from 'express';
import { 
  getAllApplicants, 
  getApplicantById, 
  updateApplicantReview,
  createInterviewSlots,
  getMySchedule,
  assignDomainHead,
  createSubsection, 
  createQuestion    
} from '../controllers/adminController';
import { authorizeRole } from '../middleware/authMiddleware'; 

const router = Router();

// Domain Heads & Root Admins can view and evaluate candidates
router.get('/applicants', authorizeRole(['DOMAIN_HEAD', 'ROOT_ADMIN']), getAllApplicants);
router.get('/applicants/:id', authorizeRole(['DOMAIN_HEAD', 'ROOT_ADMIN']), getApplicantById);

router.put('/applicants/:applicationId/review', authorizeRole(['DOMAIN_HEAD', 'ROOT_ADMIN']), updateApplicantReview);

// Domain Heads create their slots and view their schedules
router.post('/slots', authorizeRole(['DOMAIN_HEAD', 'ROOT_ADMIN']), createInterviewSlots);
router.get('/schedule/:adminId', authorizeRole(['DOMAIN_HEAD', 'ROOT_ADMIN']), getMySchedule);

// Domain Heads build their domain's application form
router.post('/form/subsection', authorizeRole(['DOMAIN_HEAD', 'ROOT_ADMIN']), createSubsection);
router.post('/form/question', authorizeRole(['DOMAIN_HEAD', 'ROOT_ADMIN']), createQuestion);

// Only the Root Admin can assign new Domain Heads
router.post('/domain-heads', authorizeRole(['ROOT_ADMIN']), assignDomainHead);

export default router;