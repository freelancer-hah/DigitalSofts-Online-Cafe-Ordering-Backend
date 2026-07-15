import Stripe from 'stripe';
import Order from '../models/Order.js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

// Create payment intent
export const createPaymentIntent = async (req, res) => {
  try {
    const { amount, orderId, customerName, phone } = req.body;

    console.log('💰 Creating payment intent:', { amount, orderId, customerName });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'pkr',
      metadata: {
        orderId: orderId || '',
        customerName: customerName || 'Guest',
        phone: phone || ''
      },
    });

    console.log('✅ Payment intent created:', paymentIntent.id);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('❌ Payment intent error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Verify payment
export const verifyPayment = async (req, res) => {
  try {
    const { paymentIntentId, orderId } = req.body;

    console.log('🔍 Verifying payment:', { paymentIntentId, orderId });

    // Get payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log('📊 Stripe payment status:', paymentIntent.status);

    if (paymentIntent.status === 'succeeded') {
      // Update order in database
      const order = await Order.findById(orderId);
      
      if (!order) {
        console.log('❌ Order not found:', orderId);
        return res.status(404).json({ 
          success: false, 
          message: 'Order not found' 
        });
      }

      console.log('📦 Updating order:', order.orderNumber);
      console.log('💰 Current payment status:', order.paymentStatus);

      order.paymentStatus = 'paid';
      order.paymentId = paymentIntentId;
      await order.save();
      
      console.log('✅ Order updated! New status:', {
        paymentStatus: order.paymentStatus,
        paymentId: order.paymentId
      });

      // Notify via Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.emit('payment-confirmed', order);
        io.emit('order-updated', order);
        console.log('📡 Payment confirmed event emitted');
      }

      res.json({ 
        success: true, 
        message: 'Payment verified successfully',
        order: order
      });
    } else {
      console.log('⚠️ Payment not succeeded. Status:', paymentIntent.status);
      res.status(400).json({ 
        success: false, 
        message: `Payment not completed. Status: ${paymentIntent.status}` 
      });
    }
  } catch (error) {
    console.error('❌ Payment verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get payment status
export const getPaymentStatus = async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    res.json({
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency
    });
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Webhook handler
export const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.log('Webhook secret not configured, skipping verification');
    return res.json({ received: true });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('PaymentIntent was successful!', paymentIntent.id);
      try {
        const order = await Order.findOneAndUpdate(
          { paymentId: paymentIntent.id },
          { paymentStatus: 'paid', status: 'Pending' },
          { new: true }
        );
        if (order) {
          const io = req.app.get('io');
          if (io) {
            io.emit('payment-confirmed', order);
            io.emit('order-updated', order);
          }
          console.log('✅ Order updated via webhook:', order.orderNumber);
        }
      } catch (error) {
        console.error('Error updating order from webhook:', error);
      }
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};