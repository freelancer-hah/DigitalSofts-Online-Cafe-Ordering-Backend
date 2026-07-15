import express from 'express';
import { 
  loginAdmin, 
  registerUser, 
  loginUser, 
  getCurrentUser 
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Admin routes
router.post('/admin/login', loginAdmin);

// User routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getCurrentUser);

export default router;