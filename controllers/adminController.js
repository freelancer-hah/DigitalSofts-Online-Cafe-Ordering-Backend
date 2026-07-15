import Order from '../models/Order.js';
import User from '../models/User.js';
import MenuItem from '../models/MenuItem.js';

export const getDashboardStats = async (req, res) => {
  try {
    console.log('📊 Fetching dashboard stats...');
    
    const [totalOrders, totalUsers, totalMenuItems, pendingOrders, paidOrders] = await Promise.all([
      Order.countDocuments(),
      User.countDocuments({ role: 'customer' }),
      MenuItem.countDocuments(),
      Order.countDocuments({ status: { $in: ['Pending', 'Preparing'] } }),
      Order.countDocuments({ paymentStatus: 'paid' })
    ]);

    console.log('📊 Stats:', { totalOrders, totalUsers, totalMenuItems, pendingOrders, paidOrders });

    res.json({
      totalOrders: totalOrders || 0,
      totalUsers: totalUsers || 0,
      totalMenuItems: totalMenuItems || 0,
      pendingOrders: pendingOrders || 0,
      paidOrders: paidOrders || 0
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getOrdersStats = async (req, res) => {
  try {
    const [totalOrders, pendingOrders] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: { $in: ['Pending', 'Preparing'] } })
    ]);

    const statusCounts = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
      totalOrders,
      pendingOrders,
      statusCounts
    });
  } catch (error) {
    console.error('Orders stats error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getUsersStats = async (req, res) => {
  try {
    const [totalUsers, newUsersToday] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({
        role: 'customer',
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      })
    ]);

    res.json({
      totalUsers,
      newUsersToday
    });
  } catch (error) {
    console.error('Users stats error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getSalesStats = async (req, res) => {
  try {
    const [totalRevenue, dailyOrders, categorySales] = await Promise.all([
      Order.aggregate([
        { $match: { status: 'Completed', paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Order.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            orders: { $sum: 1 }
          }
        },
        { $sort: { _id: -1 } },
        { $limit: 7 }
      ]),
      Order.aggregate([
        { $match: { status: 'Completed', paymentStatus: 'paid' } },
        { $unwind: '$items' },
        {
          $lookup: {
            from: 'menuitems',
            localField: 'items.menuItem',
            foreignField: '_id',
            as: 'menuItemData'
          }
        },
        { $unwind: { path: '$menuItemData', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$menuItemData.category',
            value: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
          }
        }
      ])
    ]);

    res.json({
      totalRevenue: totalRevenue[0]?.total || 0,
      dailyOrders: dailyOrders.map(d => ({
        date: d._id,
        orders: d.orders
      })),
      categorySales: categorySales.length > 0 
        ? categorySales.map(c => ({
            name: c._id || 'Other',
            value: c.value || 0
          }))
        : [{ name: 'No Data', value: 1 }]
    });
  } catch (error) {
    console.error('Sales stats error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getRecentOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('orderNumber customerName phone totalAmount status paymentStatus paymentId createdAt');
    res.json(orders);
  } catch (error) {
    console.error('Recent orders error:', error);
    res.status(500).json({ message: error.message });
  }
};