import axios from 'axios';
import Order from '../models/Order.js';
import User from '../models/User.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'https://machine-learning-mode-for-churn.onrender.com';

// ✅ Get training data for ML model
export const getTrainingData = async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer' });
    const trainingData = [];

    console.log(`📊 Processing ${customers.length} customers for training data...`);

    for (const customer of customers) {
      const orders = await Order.find({ phone: customer.phone });
      
      if (orders.length === 0) continue;

      const totalOrders = orders.length;
      const totalSpent = orders.reduce((sum, o) => sum + o.totalAmount, 0);
      const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
      const totalItems = orders.reduce((sum, o) => sum + o.items.length, 0);
      const avgItemsPerOrder = totalOrders > 0 ? totalItems / totalOrders : 0;

      // Calculate order frequency
      const orderDates = orders.map(o => o.createdAt);
      const daysDiff = orderDates.map((date, i) => {
        if (i === 0) return 0;
        return (date - orderDates[i-1]) / (1000 * 60 * 60 * 24);
      });
      const avgFrequency = daysDiff.reduce((a, b) => a + b, 0) / (daysDiff.length - 1 || 1);

      // Last order
      const lastOrder = orders[orders.length - 1];
      const daysSinceLastOrder = Math.floor((Date.now() - lastOrder.createdAt) / (1000 * 60 * 60 * 24));

      // Category preference
      const categoryCount = {};
      orders.forEach(order => {
        order.items.forEach(item => {
          const category = item.category || 'Other';
          categoryCount[category] = (categoryCount[category] || 0) + 1;
        });
      });
      const preferredCategory = Object.entries(categoryCount)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

      // Weekend orders
      const weekendOrders = orders.filter(o => {
        const day = o.createdAt.getDay();
        return day === 5 || day === 6;
      }).length;

      // Night orders (after 8 PM)
      const nightOrders = orders.filter(o => {
        const hour = o.createdAt.getHours();
        return hour >= 20;
      }).length;

      // Recent orders (last 3 months vs previous)
      const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const recentOrders = orders.filter(o => o.createdAt >= threeMonthsAgo).length;
      const previousOrders = orders.length - recentOrders;

      trainingData.push({
        customer_id: customer._id.toString(),
        days_since_last_order: daysSinceLastOrder,
        total_orders: totalOrders,
        avg_order_value: Math.round(avgOrderValue),
        total_spent: totalSpent,
        total_items: totalItems,
        avg_items_per_order: Math.round(avgItemsPerOrder * 10) / 10,
        preferred_category: preferredCategory,
        weekend_orders: weekendOrders,
        night_orders: nightOrders,
        recent_orders_3months: recentOrders,
        previous_orders_3months: previousOrders,
        order_frequency_days: Math.round(avgFrequency * 10) / 10,
        churned: daysSinceLastOrder > 30 ? 1 : 0
      });
    }

    console.log(`✅ Generated training data for ${trainingData.length} customers`);
    res.json(trainingData);
  } catch (error) {
    console.error('❌ Training data error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Detect churn risk using ML
export const detectChurnRisk = async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer', isActive: true });
    const results = [];
    const mlResults = [];

    for (const customer of customers) {
      const orders = await Order.find({ phone: customer.phone });
      if (orders.length === 0) continue;

      const features = await prepareCustomerFeatures(customer, orders);
      
      try {
        const response = await axios.post(`${ML_SERVICE_URL}/predict`, features, {
          timeout: 10000
        });
        mlResults.push({
          customer: customer,
          prediction: response.data
        });
      } catch (error) {
        console.error(`❌ ML error for ${customer._id}:`, error.message);
        // Fallback
        const fallback = await fallbackPrediction(customer._id);
        mlResults.push({
          customer: customer,
          prediction: fallback
        });
      }
    }

    // Sort by risk (highest first)
    mlResults.sort((a, b) => b.prediction.churn_risk - a.prediction.churn_risk);

    res.json({
      total_customers: mlResults.length,
      high_risk: mlResults.filter(r => r.prediction.churn_risk > 70),
      medium_risk: mlResults.filter(r => r.prediction.churn_risk > 40 && r.prediction.churn_risk <= 70),
      low_risk: mlResults.filter(r => r.prediction.churn_risk <= 40),
      all: mlResults
    });
  } catch (error) {
    console.error('❌ Churn detection error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Send re-engagement emails
export const sendReengagementEmails = async (req, res) => {
  try {
    const { riskThreshold = 70, offerType = 'percentage', offerValue = 10 } = req.body;
    
    // Get high-risk customers
    const customers = await User.find({ role: 'customer', isActive: true });
    let sentCount = 0;
    let failedCount = 0;

    for (const customer of customers) {
      const orders = await Order.find({ phone: customer.phone });
      if (orders.length === 0) continue;

      const features = await prepareCustomerFeatures(customer, orders);
      
      try {
        const response = await axios.post(`${ML_SERVICE_URL}/predict`, features, {
          timeout: 10000
        });
        
        if (response.data.churn_risk >= riskThreshold && customer.email) {
          // Send email (implement your email function here)
          console.log(`📧 Would send re-engagement email to ${customer.email}`);
          console.log(`   Risk: ${response.data.churn_risk}%`);
          console.log(`   Offer: ${offerValue}% off`);
          sentCount++;
        }
      } catch (error) {
        console.error(`❌ Error for ${customer._id}:`, error.message);
        failedCount++;
      }
    }

    res.json({
      success: true,
      sentCount,
      failedCount,
      offerUsed: { type: offerType, value: offerValue }
    });
  } catch (error) {
    console.error('❌ Send re-engagement error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get churn stats
export const getChurnStats = async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer', isActive: true });
    const stats = {
      totalCustomers: customers.length,
      highRisk: 0,
      mediumRisk: 0,
      lowRisk: 0,
      avgRisk: 0,
      predictions: []
    };

    let totalRisk = 0;
    let count = 0;

    for (const customer of customers) {
      const orders = await Order.find({ phone: customer.phone });
      if (orders.length === 0) continue;

      const features = await prepareCustomerFeatures(customer, orders);
      
      try {
        const response = await axios.post(`${ML_SERVICE_URL}/predict`, features, {
          timeout: 10000
        });
        
        const risk = response.data.churn_risk;
        totalRisk += risk;
        count++;

        if (risk > 70) stats.highRisk++;
        else if (risk > 40) stats.mediumRisk++;
        else stats.lowRisk++;

        stats.predictions.push({
          customer_id: customer._id,
          customer_name: customer.name,
          email: customer.email,
          churn_risk: risk,
          risk_level: response.data.risk_level,
          prediction: response.data.prediction
        });
      } catch (error) {
        console.error(`❌ Error for ${customer._id}:`, error.message);
      }
    }

    stats.avgRisk = count > 0 ? Math.round(totalRisk / count) : 0;
    stats.predictions.sort((a, b) => b.churn_risk - a.churn_risk);

    res.json(stats);
  } catch (error) {
    console.error('❌ Churn stats error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Prepare customer features for ML
const prepareCustomerFeatures = async (customer, orders) => {
  const totalOrders = orders.length;
  const totalSpent = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
  const totalItems = orders.reduce((sum, o) => sum + o.items.length, 0);
  const avgItemsPerOrder = totalOrders > 0 ? totalItems / totalOrders : 0;

  const lastOrder = orders[orders.length - 1];
  const daysSinceLastOrder = Math.floor((Date.now() - lastOrder.createdAt) / (1000 * 60 * 60 * 24));

  // Category preference
  const categoryCount = {};
  orders.forEach(order => {
    order.items.forEach(item => {
      const category = item.category || 'Other';
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });
  });
  const preferredCategory = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

  const weekendOrders = orders.filter(o => {
    const day = o.createdAt.getDay();
    return day === 5 || day === 6;
  }).length;

  const nightOrders = orders.filter(o => {
    const hour = o.createdAt.getHours();
    return hour >= 20;
  }).length;

  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const recentOrders = orders.filter(o => o.createdAt >= threeMonthsAgo).length;
  const previousOrders = orders.length - recentOrders;

  const orderDates = orders.map(o => o.createdAt);
  const daysDiff = orderDates.map((date, i) => {
    if (i === 0) return 0;
    return (date - orderDates[i-1]) / (1000 * 60 * 60 * 24);
  });
  const avgFrequency = daysDiff.reduce((a, b) => a + b, 0) / (daysDiff.length - 1 || 1);

  return {
    customer_id: customer._id.toString(),
    days_since_last_order: daysSinceLastOrder,
    total_orders: totalOrders,
    avg_order_value: Math.round(avgOrderValue),
    total_spent: totalSpent,
    total_items: totalItems,
    avg_items_per_order: Math.round(avgItemsPerOrder * 10) / 10,
    preferred_category: preferredCategory,
    weekend_orders: weekendOrders,
    night_orders: nightOrders,
    recent_orders_3months: recentOrders,
    previous_orders_3months: previousOrders,
    order_frequency_days: Math.round(avgFrequency * 10) / 10
  };
};

// ✅ Fallback: Rule-based prediction
const fallbackPrediction = async (customerId) => {
  const customer = await User.findById(customerId);
  const orders = await Order.find({ phone: customer.phone });
  const lastOrder = orders[orders.length - 1];
  const daysSinceLastOrder = lastOrder ? Math.floor((Date.now() - lastOrder.createdAt) / (1000 * 60 * 60 * 24)) : 999;
  
  let risk = 'Low';
  let probability = 0.1;
  let explanation = '';
  
  if (daysSinceLastOrder > 30 && orders.length < 5) {
    risk = 'High';
    probability = 0.8;
    explanation = 'No order in 30+ days and less than 5 total orders';
  } else if (daysSinceLastOrder > 14 && orders.length < 8) {
    risk = 'Medium';
    probability = 0.5;
    explanation = 'No order in 14+ days and less than 8 total orders';
  } else if (daysSinceLastOrder > 7) {
    risk = 'Medium';
    probability = 0.3;
    explanation = 'No order in 7+ days';
  }

  return {
    customer_id: customerId,
    churn_probability: probability,
    churn_risk: probability * 100,
    prediction: risk === 'High' ? 'At Risk' : 'Active',
    risk_level: risk,
    fallback: true,
    explanation: explanation,
    reason: 'ML service unavailable. Used rule-based fallback.'
  };
};