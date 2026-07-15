import express from 'express';
import { protect, protectAdmin } from '../middleware/auth.js';
import {
  getUserProfile,
  updateUserProfile,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  createStaff
} from '../controllers/userController.js';

const router = express.Router();

// Protected routes
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);

// Admin only routes
router.get('/', protectAdmin, getAllUsers);
router.get('/:id', protectAdmin, getUserById);
router.put('/:id', protectAdmin, updateUser);
router.delete('/:id', protectAdmin, deleteUser);
router.post('/staff', protectAdmin, createStaff);

export default router;