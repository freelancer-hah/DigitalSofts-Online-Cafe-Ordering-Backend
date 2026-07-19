import Cart from '../models/Cart.js';
import MenuItem from '../models/MenuItem.js';
import { sendAbandonedCartEmail } from '../utils/email.js';

// ✅ Save or update cart
export const saveCart = async (req, res) => {
  try {
    const { items, totalAmount, customerName, customerEmail, customerPhone } = req.body;
    const userId = req.user?.id;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Check if cart exists for this user/guest
    let cart = await Cart.findOne({
      $or: [
        { userId: userId },
        { customerEmail: customerEmail }
      ],
      status: { $in: ['active', 'abandoned'] }
    });

    if (cart) {
      // Update existing cart
      cart.items = items;
      cart.totalAmount = totalAmount;
      cart.customerName = customerName || cart.customerName;
      cart.customerEmail = customerEmail || cart.customerEmail;
      cart.customerPhone = customerPhone || cart.customerPhone;
      cart.status = 'active';
      cart.updatedAt = new Date();
      await cart.save();
    } else {
      // Create new cart
      cart = await Cart.create({
        userId: userId,
        customerName: customerName || '',
        customerEmail: customerEmail || '',
        customerPhone: customerPhone || '',
        items: items,
        totalAmount: totalAmount,
        status: 'active'
      });
    }

    res.json({ success: true, cart });
  } catch (error) {
    console.error('❌ Save cart error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get cart for user
export const getCart = async (req, res) => {
  try {
    const { email, phone } = req.query;
    const userId = req.user?.id;

    const cart = await Cart.findOne({
      $or: [
        { userId: userId },
        { customerEmail: email },
        { customerPhone: phone }
      ],
      status: { $in: ['active', 'abandoned'] }
    });

    res.json({ success: true, cart: cart || null });
  } catch (error) {
    console.error('❌ Get cart error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get abandoned carts (for cron job) - 12 MINUTES
export const getAbandonedCarts = async () => {
  // ✅ CHANGE: 12 minutes
  const twelveMinutesAgo = new Date(Date.now() - 12 * 60 * 1000);
  
  return await Cart.find({
    status: 'active',
    updatedAt: { $lt: twelveMinutesAgo },
    customerEmail: { $ne: '' }
  }).populate('userId');
};

// ✅ Mark cart as recovered
export const markRecovered = async (req, res) => {
  try {
    const { cartId } = req.params;
    
    const cart = await Cart.findByIdAndUpdate(cartId, {
      status: 'recovered',
      recoveredAt: new Date()
    }, { new: true });

    res.json({ success: true, cart });
  } catch (error) {
    console.error('❌ Mark recovered error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Mark cart as abandoned
export const markAbandoned = async (cartId) => {
  await Cart.findByIdAndUpdate(cartId, {
    status: 'abandoned',
    abandonedAt: new Date(),
    recoveryAttempts: 1
  });
};

// ✅ Update recovery attempts
export const updateRecoveryAttempt = async (cartId) => {
  await Cart.findByIdAndUpdate(cartId, {
    $inc: { recoveryAttempts: 1 },
    lastRecoveryEmail: new Date()
  });
};

// ✅ Admin: Get abandoned carts stats
export const getAbandonedStats = async (req, res) => {
  try {
    const totalAbandoned = await Cart.countDocuments({ status: 'abandoned' });
    const totalRecovered = await Cart.countDocuments({ status: 'recovered' });
    const totalActive = await Cart.countDocuments({ status: 'active' });

    // Get recent abandoned carts with customer info
    const recentAbandoned = await Cart.find({ status: 'abandoned' })
      .sort({ abandonedAt: -1 })
      .limit(10)
      .select('customerName customerEmail totalAmount items abandonedAt recoveryAttempts');

    res.json({
      success: true,
      stats: {
        totalAbandoned,
        totalRecovered,
        totalActive,
        recoveryRate: totalAbandoned > 0 ? Math.round((totalRecovered / (totalAbandoned + totalRecovered)) * 100) : 0
      },
      recentAbandoned
    });
  } catch (error) {
    console.error('❌ Abandoned stats error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Admin: Manually send recovery email
export const sendRecoveryEmailManually = async (req, res) => {
  try {
    const { cartId } = req.params;
    
    const cart = await Cart.findById(cartId);
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    await sendAbandonedCartEmail(cart);
    await updateRecoveryAttempt(cartId);

    res.json({ success: true, message: 'Recovery email sent' });
  } catch (error) {
    console.error('❌ Manual recovery error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Admin: Get all abandoned carts (with pagination)
export const getAllAbandonedCarts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const carts = await Cart.find({ status: 'abandoned' })
      .sort({ abandonedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('customerName customerEmail customerPhone items totalAmount abandonedAt recoveryAttempts lastRecoveryEmail');

    const total = await Cart.countDocuments({ status: 'abandoned' });

    res.json({
      success: true,
      carts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Get all abandoned carts error:', error);
    res.status(500).json({ message: error.message });
  }
};