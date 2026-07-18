import express from 'express';
import { getPersonalizedRecommendations } from '../controllers/recommendationController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Get recommendations for logged-in user (authenticated)
router.get('/personalized', protect, getPersonalizedRecommendations);

// Get recommendations by phone (for guest checkout)
router.get('/personalized/:phone', getPersonalizedRecommendations);

export default router;