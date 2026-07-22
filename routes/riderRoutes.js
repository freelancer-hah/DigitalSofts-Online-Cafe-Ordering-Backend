import express from 'express';
import {
  createRider,
  loginRider,
  getRiderProfile,
  updateRiderStatus,
  updateRiderLocation,
  getAllRiders,
  getRiderById,
  deleteRider
} from '../controllers/riderController.js';
import { protect, protectAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public
router.post('/login', loginRider);

// Admin only
router.post('/create', protectAdmin, createRider);
router.get('/all', protectAdmin, getAllRiders);

// ✅ Rider protected – MUST come before '/:id', warna Express
// "/profile" ko id="profile" samajh ke /:id route match kar deta hai
router.get('/profile', protect, getRiderProfile);
router.put('/status', protect, updateRiderStatus);
router.put('/location', protect, updateRiderLocation);

// Admin only – dynamic ':id' routes hamesha SABSE AAKHIR me
router.get('/:id', protectAdmin, getRiderById);
router.delete('/:id', protectAdmin, deleteRider);

export default router;