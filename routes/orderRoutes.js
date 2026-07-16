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

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// Create a new order
router.post("/", createOrder);

// ✅ IMPORTANT: Specific routes BEFORE dynamic routes
// Get orders by phone number (for user profile)
router.get("/track/all", getOrdersByPhone);

// Track a single order by order number
router.get("/track/:orderNumber", trackOrder);

// Get single order with phone verification
router.get("/customer/order/:orderNumber", getOrderByNumber);

// ============================================
// PROTECTED USER ROUTES (Requires login)
// ============================================

// Get current user's orders
router.get("/my-orders", protect, getMyOrders);

// ============================================
// ADMIN ROUTES (Requires admin login)
// ============================================

// Get all orders (with optional status filter)
router.get("/", protectAdmin, getAllOrders);

// Update order status
router.patch("/:id/status", protectAdmin, updateOrderStatus);

// Manually mark order as paid (debug)
router.post("/:id/mark-paid", protectAdmin, markOrderAsPaid);

export default router;