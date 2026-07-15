import express from 'express';
import {
  createPaymentIntent,
  verifyPayment,
  getPaymentStatus,
  handleWebhook
} from '../controllers/paymentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Webhook route (no authentication needed)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Protected routes
router.post('/create-intent', protect, createPaymentIntent);
router.post('/verify', protect, verifyPayment);
router.get('/status/:paymentIntentId', protect, getPaymentStatus);

export default router;