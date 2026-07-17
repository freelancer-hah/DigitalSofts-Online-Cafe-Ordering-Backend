import Order from '../models/Order.js';
import User from '../models/User.js';
import { sendReengagementEmail } from '../utils/email.js';

// ✅ Detect churn risk using ML
export const detectChurnRisk = async (req, res) => {
  try {
    // Call batch prediction
    const response = await axios.post(`${ML_SERVICE_URL}/batch-predict`, {
      customers: await getCustomerData()
    });
    
    const predictions = response.data;
    
    // Filter high-risk customers
    const highRisk = predictions.filter(p => p.churn_risk > 60);
    const mediumRisk = predictions.filter(p => p.churn_risk > 30 && p.churn_risk <= 60);
    
    res.json({
      total_customers: predictions.length,
      high_risk_count: highRisk.length,
      medium_risk_count: mediumRisk.length,
      high_risk: highRisk,
      medium_risk: mediumRisk,
      predictions: predictions
    });
    
  } catch (error) {
    console.error('❌ Churn detection error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Send re-engagement emails to high-risk customers
export const sendReengagementEmails = async (req, res) => {
  try {
    const { riskThreshold = 70, offerType = 'percentage', offerValue = 10 } = req.body;
    
    // Get high-risk customers
    const predictions = await getChurnPredictions();
    const highRisk = predictions.filter(p => p.churn_risk >= riskThreshold);
    
    let sentCount = 0;
    let failedCount = 0;

    for (const customer of highRisk) {
      const user = await User.findById(customer.customer_id);
      if (!user || !user.email) continue;

      // Get customer's favorite items
      const orders = await Order.find({ phone: user.phone });
      const itemCount = {};
      orders.forEach(order => {
        order.items.forEach(item => {
          itemCount[item.name] = (itemCount[item.name] || 0) + item.quantity;
        });
      });
      const favoriteItems = Object.entries(itemCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(item => item[0]);

      // Send email
      const emailSent = await sendReengagementEmail(user, favoriteItems, offerType, offerValue);
      
      if (emailSent) {
        sentCount++;
        await logReengagement(user._id, 'email_sent', offerType, offerValue);
      } else {
        failedCount++;
      }
    }

    res.json({
      success: true,
      sentCount,
      failedCount,
      totalHighRisk: highRisk.length,
      offerUsed: { type: offerType, value: offerValue }
    });
    
  } catch (error) {
    console.error('❌ Send re-engagement error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get churn statistics
export const getChurnStats = async (req, res) => {
  try {
    const predictions = await getChurnPredictions();
    
    const total = predictions.length;
    const highRisk = predictions.filter(p => p.churn_risk > 70).length;
    const mediumRisk = predictions.filter(p => p.churn_risk > 40 && p.churn_risk <= 70).length;
    const lowRisk = predictions.filter(p => p.churn_risk <= 40).length;
    
    const avgRisk = predictions.reduce((sum, p) => sum + p.churn_risk, 0) / total || 0;
    
    res.json({
      totalCustomers: total,
      highRisk,
      mediumRisk,
      lowRisk,
      avgRisk: Math.round(avgRisk),
      predictions: predictions.slice(0, 20) // Top 20 for display
    });
    
  } catch (error) {
    console.error('❌ Churn stats error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get customer data for ML
const getCustomerData = async () => {
  const customers = await User.find({ role: 'customer' });
  const data = [];
  
  for (const customer of customers) {
    const orders = await Order.find({ phone: customer.phone });
    if (orders.length === 0) continue;
    
    data.push(await prepareCustomerFeatures(customer, orders));
  }
  
  return data;
};

// ✅ Get churn predictions
const getChurnPredictions = async () => {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/batch-predict`, {
      customers: await getCustomerData()
    });
    return response.data;
  } catch (error) {
    console.error('❌ ML prediction error:', error);
    // Return fallback predictions
    return [];
  }
};