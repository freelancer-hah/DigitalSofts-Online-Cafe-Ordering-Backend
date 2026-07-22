import Order from "../models/Order.js";
import { sendOrderConfirmation, sendOrderStatusUpdate } from '../utils/email.js';

// Generates a short, human-friendly order number e.g. ORD-4F82A1
const generateOrderNumber = () => {
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${random}`;
};

// Public: place a new order
export const createOrder = async (req, res) => {
  try {
    const { customerName, phone, email, address, orderType, items, notes } = req.body;

    console.log('📦 Creating order...');
    console.log('📧 Customer email received:', email);
    console.log('📱 Phone:', phone);
    console.log('📋 Items:', items?.length);

    if (!customerName || !phone || !items || items.length === 0) {
      return res.status(400).json({ message: "Customer name, phone, and at least one item are required" });
    }

    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    let orderNumber = generateOrderNumber();
    while (await Order.findOne({ orderNumber })) {
      orderNumber = generateOrderNumber();
    }

    // ✅ Save order with email and deliveryStatus
    const order = await Order.create({
      orderNumber,
      customerName,
      phone: phone,
      email: email || "",
      address: address || "",
      orderType: orderType || "Pickup",
      items,
      totalAmount,
      notes: notes || "",
      paymentStatus: 'pending',
      status: 'Pending',
      // ✅ Set deliveryStatus based on order type
      deliveryStatus: orderType === 'Delivery' ? 'pending' : null,
    });

    console.log('✅ Order created:', order.orderNumber);
    console.log('📧 Email saved:', order.email);
    console.log('📱 Phone saved:', order.phone);
    console.log('📦 Delivery status:', order.deliveryStatus);

    // ✅ Send confirmation email in BACKGROUND (non-blocking)
    if (order.email && order.email !== '') {
      setTimeout(async () => {
        try {
          console.log(`📧 Sending confirmation email to ${order.email}...`);
          const emailSent = await sendOrderConfirmation(order, order.email);
          if (emailSent) {
            console.log('✅ Confirmation email sent successfully');
          } else {
            console.log('⚠️ Failed to send confirmation email');
          }
        } catch (emailErr) {
          console.error('❌ Email error:', emailErr.message);
        }
      }, 100);
    } else {
      console.log('⚠️ No email provided, skipping email');
    }

    // Notify admin
    const io = req.app.get("io");
    if (io) io.emit("new-order", order);

    res.status(201).json(order);
  } catch (err) {
    console.error('Create order error:', err);
    res.status(400).json({ message: "Could not place order", error: err.message });
  }
};

// Public: track an order by order number
export const trackOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { phone } = req.query;

    const order = await Order.findOne({ orderNumber });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (phone && order.phone !== phone) {
      return res.status(403).json({ message: "Phone number does not match this order" });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get orders by phone number
export const getOrdersByPhone = async (req, res) => {
  try {
    let { phone } = req.query;
    
    console.log('📋 Searching for phone:', phone);
    
    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }
    
    const cleanPhone = phone.replace(/\+/g, '').replace(/\s/g, '');
    const phoneWithPlus = '+' + cleanPhone;
    
    console.log('📋 Searching with:', { cleanPhone, phoneWithPlus });
    
    const orders = await Order.find({
      $or: [
        { phone: phone },
        { phone: cleanPhone },
        { phone: phoneWithPlus }
      ]
    }).sort({ createdAt: -1 });
    
    console.log(`📋 Found ${orders.length} orders for ${phone}`);
    
    res.json(orders);
  } catch (error) {
    console.error('Get orders by phone error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get single order by number for customer
export const getOrderByNumber = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { phone } = req.query;
    
    const order = await Order.findOne({ orderNumber });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    if (order.phone !== phone && order.phone !== phone.replace('+', '') && order.phone !== '+' + phone.replace('+', '')) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Get order by number error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get orders for the logged-in user
export const getMyOrders = async (req, res) => {
  try {
    const userPhone = req.user?.phone || '';
    const orders = await Order.find({ 
      phone: userPhone 
    }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Get my orders error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Admin: get all orders
export const getAllOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Admin: update order status
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["Pending", "Preparing", "Ready", "Completed", "Cancelled"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });

    // ✅ Send status update in BACKGROUND (non-blocking)
    if (order.email && order.email !== '') {
      setTimeout(async () => {
        try {
          console.log(`📧 Sending status update to ${order.email}...`);
          const emailSent = await sendOrderStatusUpdate(order, order.email);
          if (emailSent) {
            console.log('✅ Status update email sent successfully');
          }
        } catch (emailErr) {
          console.error('❌ Status email error:', emailErr.message);
        }
      }, 100);
    }

    const io = req.app.get("io");
    if (io) io.emit("order-updated", order);

    res.json(order);
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Admin: Mark order as paid
export const markOrderAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentId } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.paymentStatus = 'paid';
    order.paymentId = paymentId || 'manual_' + Date.now();
    await order.save();

    console.log(`✅ Order ${order.orderNumber} marked as paid manually`);

    const io = req.app.get('io');
    if (io) {
      io.emit('payment-confirmed', order);
      io.emit('order-updated', order);
    }

    res.json({ 
      success: true, 
      message: 'Order marked as paid',
      order: order 
    });
  } catch (error) {
    console.error('Mark as paid error:', error);
    res.status(500).json({ message: error.message });
  }
};