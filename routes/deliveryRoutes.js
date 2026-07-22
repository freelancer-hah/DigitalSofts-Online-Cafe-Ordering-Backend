import express from 'express';
import {
  assignDelivery,
  acceptDelivery,
  pickUpDelivery,
  startDelivery,
  completeDelivery,
  getRiderDeliveries,
  getAllDeliveries,
  getDeliveryByOrder,
  updateLocationHistory
} from '../controllers/deliveryController.js';
import { protect, protectAdmin } from '../middleware/auth.js';

const router = express.Router();

// Admin routes
router.post('/assign', protectAdmin, assignDelivery);
router.get('/all', protectAdmin, getAllDeliveries);

// ✅ Rider routes – use 'protect'
router.get('/my', protect, getRiderDeliveries);
router.put('/:deliveryId/accept', protect, acceptDelivery);
router.put('/:deliveryId/pickup', protect, pickUpDelivery);
router.put('/:deliveryId/start', protect, startDelivery);
router.put('/:deliveryId/complete', protect, completeDelivery);
router.put('/:deliveryId/location', protect, updateLocationHistory);

// Public (customer tracking) – may be kept unprotected or use a customer auth later
router.get('/order/:orderId', getDeliveryByOrder);

export default router;