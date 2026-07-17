import express from 'express';
import { 
  detectChurnRisk,
  sendReengagementEmails,
  getChurnStats,
  getTrainingData
} from '../controllers/mlChurnController.js';
import { protectAdmin } from '../middleware/auth.js';

const router = express.Router();

// ✅ Admin routes
router.get('/training-data', protectAdmin, getTrainingData);
router.get('/detect', protectAdmin, detectChurnRisk);
router.post('/send-reengagement', protectAdmin, sendReengagementEmails);
router.get('/stats', protectAdmin, getChurnStats);

export default router;