import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';
import User from '../models/User.js';

// Get personalized recommendations for a customer
export const getPersonalizedRecommendations = async (req, res) => {
  try {
    // Get user ID from authenticated user
    const userId = req.user?.id;
    const userEmail = req.user?.email;
    let customerPhone = req.params.phone || req.query.phone;

    console.log('👤 User ID:', userId);
    console.log('📧 User Email:', userEmail);
    console.log('📱 Phone from params:', customerPhone);

    let orders = [];

    // PRIORITY 1: Find orders by user ID (if user is logged in)
    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        console.log('👤 User found:', user.email);
        
        if (user.phone) {
          customerPhone = user.phone.replace(/\+/g, '').replace(/\s/g, '');
          orders = await Order.find({ 
            $or: [
              { phone: user.phone },
              { phone: '+' + user.phone },
              { phone: customerPhone }
            ]
          }).sort({ createdAt: -1 });
        }
        
        if (orders.length === 0 && user.email) {
          orders = await Order.find({ 
            customerEmail: user.email 
          }).sort({ createdAt: -1 });
        }
      }
    }

    // PRIORITY 2: Find orders by phone (if provided)
    if (orders.length === 0 && customerPhone) {
      const cleanPhone = customerPhone.replace(/\+/g, '').replace(/\s/g, '');
      orders = await Order.find({ 
        $or: [
          { phone: cleanPhone },
          { phone: '+' + cleanPhone },
          { phone: customerPhone }
        ]
      }).sort({ createdAt: -1 });
    }

    // PRIORITY 3: Find orders by email (if user is logged in)
    if (orders.length === 0 && userEmail) {
      orders = await Order.find({ 
        customerEmail: userEmail 
      }).sort({ createdAt: -1 });
    }

    console.log(`📦 Found ${orders.length} total orders for customer`);

    if (orders.length === 0) {
      const popularItems = await getPopularItems();
      return res.json({
        type: 'popular',
        title: '🔥 Most Popular Dishes',
        items: popularItems,
        reason: 'Welcome! Here are our most popular dishes',
        stats: {
          totalOrders: 0,
          favoriteCategory: 'None',
          averageOrder: 0
        }
      });
    }

    const analysis = await analyzeOrderHistory(orders);
    console.log('📊 Analysis:', analysis);
    
    const recommendations = await generateRecommendations(analysis, orders);

    let title = '🎯 Recommended for You';
    if (analysis.totalOrders >= 5) {
      title = `🌟 Based on Your ${analysis.totalOrders} Orders`;
    } else if (analysis.totalOrders >= 2) {
      title = '📚 You Might Also Like';
    }

    res.json({
      type: 'personalized',
      title: title,
      items: recommendations,
      reason: `Based on your ${analysis.totalOrders} past orders`,
      stats: {
        totalOrders: analysis.totalOrders,
        favoriteCategory: analysis.favoriteCategory,
        averageOrder: analysis.averageOrderValue
      }
    });

  } catch (error) {
    console.error('❌ Recommendation error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Analyze order history
const analyzeOrderHistory = async (orders) => {
  const itemFrequency = {};
  const categoryFrequency = {};
  let totalSpent = 0;
  let totalItems = 0;

  const allMenuItems = await MenuItem.find();
  const itemCategoryMap = {};
  allMenuItems.forEach(item => {
    itemCategoryMap[item.name.toLowerCase()] = item.category;
  });

  orders.forEach(order => {
    totalSpent += order.totalAmount;
    order.items.forEach(item => {
      const key = item.name.toLowerCase();
      itemFrequency[key] = (itemFrequency[key] || 0) + item.quantity;
      totalItems += item.quantity;

      const category = itemCategoryMap[key] || 'Other';
      categoryFrequency[category] = (categoryFrequency[category] || 0) + item.quantity;
    });
  });

  const sortedItems = Object.entries(itemFrequency)
    .sort((a, b) => b[1] - a[1]);

  const sortedCategories = Object.entries(categoryFrequency)
    .sort((a, b) => b[1] - a[1]);

  return {
    topItems: sortedItems.slice(0, 5).map(([name, count]) => ({ name, count })),
    favoriteCategory: sortedCategories.length > 0 ? sortedCategories[0][0] : 'Main Course',
    averageOrderValue: orders.length > 0 ? Math.round(totalSpent / orders.length) : 0,
    totalOrders: orders.length,
    totalItems: totalItems,
    recentOrders: orders.slice(0, 3)
  };
};

// Generate recommendations based on analysis
const generateRecommendations = async (analysis, orders) => {
  const recommendations = [];
  const addedNames = new Set();
  
  const allMenuItems = await MenuItem.find({ available: true });

  // 1. Similar items
  const topItemNames = analysis.topItems.map(item => item.name);
  const topItemCategories = new Set();
  
  allMenuItems.forEach(item => {
    if (topItemNames.includes(item.name.toLowerCase())) {
      topItemCategories.add(item.category);
    }
  });

  const similarItems = allMenuItems.filter(item => 
    !topItemNames.includes(item.name.toLowerCase()) &&
    topItemCategories.has(item.category) &&
    item.available
  );

  similarItems.forEach(item => {
    if (recommendations.length < 2 && !addedNames.has(item.name)) {
      recommendations.push({
        ...item.toObject(),
        reason: `Since you love ${analysis.topItems[0]?.name || 'this category'}`
      });
      addedNames.add(item.name);
    }
  });

  // 2. Frequently bought together
  const combos = await getFrequentlyBoughtTogether(orders);
  combos.forEach(item => {
    if (recommendations.length < 4 && !addedNames.has(item.name)) {
      recommendations.push({
        ...item.toObject(),
        reason: '🔄 Frequently bought together'
      });
      addedNames.add(item.name);
    }
  });

  // 3. Popular items
  if (recommendations.length < 4) {
    const popularItems = await getPopularItems();
    popularItems.forEach(item => {
      if (recommendations.length < 4 && !addedNames.has(item.name)) {
        recommendations.push({
          ...item.toObject(),
          reason: '🔥 Popular choice'
        });
        addedNames.add(item.name);
      }
    });
  }

  return recommendations.slice(0, 6);
};

// Get popular items (global)
const getPopularItems = async () => {
  try {
    const orders = await Order.find();
    const itemCount = {};

    orders.forEach(order => {
      order.items.forEach(item => {
        const key = item.name.toLowerCase();
        itemCount[key] = (itemCount[key] || 0) + item.quantity;
      });
    });

    const sorted = Object.entries(itemCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(item => item[0]);

    const items = await MenuItem.find({ 
      available: true,
      name: { $in: sorted.map(name => new RegExp('^' + name + '$', 'i')) }
    });

    if (items.length === 0) {
      return await MenuItem.find({ available: true }).limit(6);
    }

    return items;
  } catch (error) {
    console.error('Error getting popular items:', error);
    return await MenuItem.find({ available: true }).limit(6);
  }
};

// Get frequently bought together items
const getFrequentlyBoughtTogether = async (orders) => {
  try {
    const comboFrequency = {};

    orders.forEach(order => {
      const itemNames = order.items.map(item => item.name.toLowerCase());
      for (let i = 0; i < itemNames.length; i++) {
        for (let j = i + 1; j < itemNames.length; j++) {
          const key = [itemNames[i], itemNames[j]].sort().join('+');
          comboFrequency[key] = (comboFrequency[key] || 0) + 1;
        }
      }
    });

    const sortedCombos = Object.entries(comboFrequency)
      .sort((a, b) => b[1] - a[1]);

    if (sortedCombos.length === 0) {
      return [];
    }

    const comboItems = sortedCombos[0][0].split('+');
    
    const items = await MenuItem.find({
      available: true,
      name: { $in: comboItems.map(name => new RegExp('^' + name + '$', 'i')) }
    });

    return items;
  } catch (error) {
    console.error('Error getting frequently bought together:', error);
    return [];
  }
};