import express from 'express';
import { protectAdmin } from '../middleware/auth.js';
import {
  getDashboardStats,
  getOrdersStats,
  getUsersStats,
  getSalesStats,
  getRecentOrders
} from '../controllers/adminController.js';

const router = express.Router();

// All routes require admin authentication
router.use(protectAdmin);

router.get('/stats/dashboard', getDashboardStats);
router.get('/stats/orders', getOrdersStats);
router.get('/stats/users', getUsersStats);
router.get('/stats/sales', getSalesStats);
router.get('/orders/recent', getRecentOrders);

export default router;