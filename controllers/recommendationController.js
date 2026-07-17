import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';

// Get personalized recommendations for a customer
export const getPersonalizedRecommendations = async (req, res) => {
  try {
    const customerPhone = req.user?.phone || req.params.phone || req.query.phone;
    
    if (!customerPhone) {
      return res.status(400).json({ message: 'Customer phone required' });
    }

    console.log('📊 Generating recommendations for:', customerPhone);

    // 1. Get customer order history - ✅ FIXED: Simple phone search
    const orders = await Order.find({ 
      phone: customerPhone
    }).sort({ createdAt: -1 });

    console.log(`📦 Found ${orders.length} orders for customer`);

    if (orders.length === 0) {
      // New customer - show popular items
      const popularItems = await getPopularItems();
      return res.json({
        type: 'popular',
        title: '🔥 Most Popular Dishes',
        items: popularItems,
        reason: 'New customer - showing most popular dishes'
      });
    }

    // 2. Analyze order patterns
    const analysis = await analyzeOrderHistory(orders);
    console.log('📊 Analysis:', analysis);
    
    // 3. Generate recommendations
    const recommendations = await generateRecommendations(analysis, orders);

    // 4. Add personalized message
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

  // Get all menu items for category mapping
  const allMenuItems = await MenuItem.find();
  const itemCategoryMap = {};
  allMenuItems.forEach(item => {
    itemCategoryMap[item.name.toLowerCase()] = item.category;
  });

  orders.forEach(order => {
    totalSpent += order.totalAmount;
    order.items.forEach(item => {
      // Count item frequency
      const key = item.name.toLowerCase();
      itemFrequency[key] = (itemFrequency[key] || 0) + item.quantity;
      totalItems += item.quantity;

      // Count category frequency
      const category = itemCategoryMap[key] || 'Other';
      categoryFrequency[category] = (categoryFrequency[category] || 0) + item.quantity;
    });
  });

  // Find most ordered items
  const sortedItems = Object.entries(itemFrequency)
    .sort((a, b) => b[1] - a[1]);

  // Find favorite category
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
  
  // Get all available menu items
  const allMenuItems = await MenuItem.find({ available: true });

  // 1. Similar items to top ordered items (Category-based)
  const topItemNames = analysis.topItems.map(item => item.name);
  const topItemCategories = new Set();
  
  // Get categories of top items
  allMenuItems.forEach(item => {
    if (topItemNames.includes(item.name.toLowerCase())) {
      topItemCategories.add(item.category);
    }
  });

  // Find similar items in same categories
  const similarItems = allMenuItems.filter(item => 
    !topItemNames.includes(item.name.toLowerCase()) &&
    topItemCategories.has(item.category) &&
    item.available
  );

  // Add similar items (max 2)
  similarItems.forEach(item => {
    if (recommendations.length < 2 && !addedNames.has(item.name)) {
      recommendations.push({
        ...item.toObject(),
        reason: `Since you love ${analysis.topItems[0]?.name || 'this category'}`
      });
      addedNames.add(item.name);
    }
  });

  // 2. Frequently bought together (from order history)
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

  // 3. Popular items (global) - fill remaining slots
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

// ✅ FIXED: Get popular items (global) - No regex issues
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

    // Get top item names
    const sorted = Object.entries(itemCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(item => item[0]);

    // ✅ FIXED: Find items by name using $in with exact matches
    const items = await MenuItem.find({ 
      available: true,
      name: { $in: sorted.map(name => new RegExp('^' + name + '$', 'i')) }
    });

    // If no items found, return random available items
    if (items.length === 0) {
      return await MenuItem.find({ available: true }).limit(6);
    }

    return items;
  } catch (error) {
    console.error('Error getting popular items:', error);
    return await MenuItem.find({ available: true }).limit(6);
  }
};

// ✅ FIXED: Get frequently bought together items - No regex issues
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

    // Find most common combo
    const sortedCombos = Object.entries(comboFrequency)
      .sort((a, b) => b[1] - a[1]);

    if (sortedCombos.length === 0) {
      return [];
    }

    // Get items from the most common combo
    const comboItems = sortedCombos[0][0].split('+');
    
    // ✅ FIXED: Find items by name using $in with exact matches
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