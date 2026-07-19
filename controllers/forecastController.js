import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';

// ✅ Simple AI Forecasting - No external libraries needed!
export const getSalesForecast = async (req, res) => {
  try {
    // 1. Get historical data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const orders = await Order.find({
      createdAt: { $gte: thirtyDaysAgo },
      status: { $ne: 'Cancelled' }
    });

    if (orders.length === 0) {
      return res.json({
        success: true,
        forecast: [],
        message: 'Not enough data for forecasting',
        recommendation: 'Collect more order data for accurate predictions'
      });
    }

    console.log(`📊 Analyzing ${orders.length} orders for forecasting...`);

    // 2. Group orders by day
    const dailyOrders = {};
    orders.forEach(order => {
      const date = order.createdAt.toISOString().split('T')[0];
      dailyOrders[date] = (dailyOrders[date] || 0) + 1;
    });

    // 3. Calculate daily averages
    const days = Object.keys(dailyOrders);
    const values = Object.values(dailyOrders);
    const avgOrders = values.reduce((a, b) => a + b, 0) / values.length;

    // 4. Find day patterns
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayPatterns = {};
    
    orders.forEach(order => {
      const day = order.createdAt.getDay();
      const dayName = dayNames[day];
      if (!dayPatterns[dayName]) {
        dayPatterns[dayName] = { total: 0, count: 0 };
      }
      dayPatterns[dayName].total += 1;
      dayPatterns[dayName].count += 1;
    });

    Object.keys(dayPatterns).forEach(day => {
      dayPatterns[day] = Math.round(dayPatterns[day].total / dayPatterns[day].count);
    });

    // 5. Find peak hours
    const hourPatterns = {};
    orders.forEach(order => {
      const hour = order.createdAt.getHours();
      const timeSlot = `${hour}:00 - ${hour + 1}:00`;
      hourPatterns[timeSlot] = (hourPatterns[timeSlot] || 0) + 1;
    });

    const sortedHours = Object.entries(hourPatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // 6. Find top selling items
    const itemCount = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        itemCount[item.name] = (itemCount[item.name] || 0) + item.quantity;
      });
    });

    const topItems = Object.entries(itemCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // 7. Calculate trend
    const trend = calculateTrend(values);

    // 8. Generate predictions for next 7 days
    const next7Days = [];
    const today = new Date();
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dayName = dayNames[date.getDay()];
      
      const predicted = dayPatterns[dayName] || Math.round(avgOrders);
      next7Days.push({
        date: date.toISOString().split('T')[0],
        day: dayName,
        predictedOrders: predicted,
        confidence: Math.min(Math.round((predicted / (Math.max(...values) || 1)) * 100), 95)
      });
    }

    // 9. Generate recommendations
    const recommendations = generateRecommendations(next7Days, topItems, trend);

    res.json({
      success: true,
      summary: {
        totalOrders: orders.length,
        averageDailyOrders: Math.round(avgOrders),
        bestDay: getBestDay(dayPatterns),
        bestHour: sortedHours[0]?.[0] || 'No data',
        topItems: topItems,
        trend: trend
      },
      dailyPatterns: dayPatterns,
      hourPatterns: sortedHours,
      next7Days: next7Days,
      recommendations: recommendations,
      forecastDate: new Date().toISOString(),
      dataPoints: values.length
    });

  } catch (error) {
    console.error('❌ Forecast error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Calculate trend
const calculateTrend = (values) => {
  if (values.length < 7) return { direction: 'insufficient_data', percentage: 0 };
  
  const half = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, half);
  const secondHalf = values.slice(half);
  
  const avg1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avg2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  const change = ((avg2 - avg1) / avg1) * 100;
  
  if (change > 10) return { direction: 'increasing', percentage: Math.round(change) };
  if (change < -10) return { direction: 'decreasing', percentage: Math.round(Math.abs(change)) };
  return { direction: 'stable', percentage: Math.round(Math.abs(change)) };
};

// ✅ Get best day
const getBestDay = (patterns) => {
  let best = { day: '', value: 0 };
  Object.entries(patterns).forEach(([day, value]) => {
    if (value > best.value) {
      best = { day, value };
    }
  });
  return best;
};

// ✅ Generate recommendations
const generateRecommendations = (forecast, topItems, trend) => {
  const recommendations = [];

  const busiestDay = forecast.reduce((a, b) => a.predictedOrders > b.predictedOrders ? a : b);
  if (busiestDay.predictedOrders > 10) {
    recommendations.push({
      type: 'busy_day',
      message: `📈 ${busiestDay.day} (${busiestDay.date}) is expected to be busy with ${busiestDay.predictedOrders} orders. Prepare extra staff!`,
      priority: 'high'
    });
  }

  if (trend.direction === 'increasing') {
    recommendations.push({
      type: 'trend',
      message: `📈 Orders are increasing by ${trend.percentage}%. Consider expanding capacity!`,
      priority: 'medium'
    });
  }

  if (topItems.length > 0) {
    recommendations.push({
      type: 'popular_items',
      message: `🔥 Top items: ${topItems.slice(0, 3).map(i => `${i[0]} (${i[1]} orders)`).join(', ')}`,
      priority: 'low'
    });
  }

  const avgForecast = forecast.reduce((a, b) => a + b.predictedOrders, 0) / forecast.length;
  if (avgForecast > 5) {
    recommendations.push({
      type: 'inventory',
      message: `📦 Expected average of ${Math.round(avgForecast)} orders/day. Stock up on ingredients!`,
      priority: 'medium'
    });
  }

  return recommendations;
};

// ✅ Get simple forecast
export const getSimpleForecast = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const orders = await Order.find({
      createdAt: { $gte: thirtyDaysAgo },
      status: { $ne: 'Cancelled' }
    });

    const dailyData = {};
    orders.forEach(order => {
      const date = order.createdAt.toISOString().split('T')[0];
      dailyData[date] = (dailyData[date] || 0) + 1;
    });

    const values = Object.values(dailyData);
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    res.json({
      dailyData,
      average: Math.round(avg),
      totalOrders: orders.length,
      daysCount: Object.keys(dailyData).length,
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Simple forecast error:', error);
    res.status(500).json({ message: error.message });
  }
};