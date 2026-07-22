import axios from 'axios';
import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ✅ Get restaurant context for system prompt
const getRestaurantContext = async () => {
  const menuItems = await MenuItem.find({ available: true }).limit(5);
  const menuList = menuItems.map(item => `- ${item.name} (Rs ${item.price})`).join('\n');
  return {
    name: 'Spice Corner',
    address: '123 Food Street, Lahore',
    phone: '+92 300 1234567',
    email: 'info@spicecorner.com',
    timings: 'Mon-Fri: 11:00 AM - 11:00 PM, Sat-Sun: 12:00 PM - 12:00 AM',
    delivery: '20-30 minutes, minimum order Rs 500',
    payment: 'Cash on Delivery, Card Payment via Stripe',
    menu: menuList || 'Variety of Pakistani dishes available.'
  };
};

// ✅ Generate system prompt
const buildSystemPrompt = (context) => {
  return `You are "Spice Assistant", an AI chatbot for Spice Corner restaurant.
Your job is to help customers with their queries. Be friendly, helpful, and concise.

RESTAURANT INFO:
- Name: ${context.name}
- Address: ${context.address}
- Phone: ${context.phone}
- Email: ${context.email}
- Timings: ${context.timings}
- Delivery: ${context.delivery}
- Payment: ${context.payment}
- Menu (sample):\n${context.menu}

CAPABILITIES:
1. Answer questions about menu, timings, delivery, payment.
2. Track orders: if user gives order number (e.g., ORD-4F82A1), I will search the database.
3. Give helpful recommendations.
4. Be polite and use emojis when appropriate.

If you don't know something, say you'll check with the team and suggest contacting support.

Keep responses under 3 sentences unless detailed info is requested.`;
};

// ✅ Main chat handler
export const chatWithBot = async (req, res) => {
  try {
    const { message, orderNumber } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('💬 User message:', message);

    // Get restaurant context
    const context = await getRestaurantContext();
    const systemPrompt = buildSystemPrompt(context);

    // Check if user is asking about order status
    let orderInfo = '';
    let orderNumberFromMessage = orderNumber || message.match(/ORD-[A-Z0-9]{6}/i)?.[0]?.toUpperCase();
    
    if (orderNumberFromMessage) {
      const order = await Order.findOne({ orderNumber: orderNumberFromMessage });
      if (order) {
        orderInfo = `\nOrder found: #${order.orderNumber}, Status: ${order.status}, Total: Rs ${order.totalAmount}, Customer: ${order.customerName}`;
        console.log(`📦 Found order: ${order.orderNumber}`);
      } else {
        orderInfo = `\nNo order found with number ${orderNumberFromMessage}. Please ask customer to verify the order number.`;
      }
    }

    // Build user prompt with context
    let userPrompt = message;
    if (orderInfo) {
      userPrompt += `\n\nAdditional context:\n${orderInfo}`;
    }

    // Call Gemini API
    const response = await axios.post(
      GEMINI_API_URL,
      {
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${systemPrompt}\n\nUser: ${userPrompt}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300,
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );

    const botReply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "I'm not sure how to respond. Please contact our support team.";

    console.log('🤖 Bot reply:', botReply);

    res.json({ success: true, reply: botReply });

  } catch (error) {
    console.error('❌ Chat error:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      reply: '😅 I\'m having trouble right now. Please try again later or contact support directly.',
      error: error.message
    });
  }
};

// ✅ Get menu for quick display (optional)
export const getQuickMenu = async (req, res) => {
  try {
    const items = await MenuItem.find({ available: true }).limit(10);
    res.json({ success: true, menu: items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};