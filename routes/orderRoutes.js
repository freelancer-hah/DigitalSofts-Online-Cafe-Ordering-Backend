import express from 'express';
import {
  createOrder,
  trackOrder,
  getAllOrders,
  updateOrderStatus,
  getMyOrders,
  getOrdersByPhone,
  getOrderByNumber,
  markOrderAsPaid
} from '../controllers/orderController.js';
import { protectAdmin, protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post("/", createOrder);
router.get("/track/:orderNumber", trackOrder);
router.get("/track/all", getOrdersByPhone);
router.get("/customer/order/:orderNumber", getOrderByNumber);

// Protected user routes
router.get("/my-orders", protect, getMyOrders);

// Admin routes
router.get("/", protectAdmin, getAllOrders);
router.patch("/:id/status", protectAdmin, updateOrderStatus);
router.post("/:id/mark-paid", protectAdmin, markOrderAsPaid);

export default router;