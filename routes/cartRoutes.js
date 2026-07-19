import express from 'express';
import {
  saveCart,
  getCart,
  getAbandonedStats,
  sendRecoveryEmailManually,
  markRecovered
} from '../controllers/cartController.js';
import { protect, protectAdmin } from '../middleware/auth.js';

const router = express.Router();

// User routes
router.post('/save', protect, saveCart);
router.get('/get', protect, getCart);

// Admin routes
router.get('/abandoned-stats', protectAdmin, getAbandonedStats);
router.post('/send-recovery/:cartId', protectAdmin, sendRecoveryEmailManually);
router.post('/mark-recovered/:cartId', protectAdmin, markRecovered);

export default router;