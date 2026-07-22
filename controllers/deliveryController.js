import Delivery from '../models/Delivery.js';
import Order from '../models/Order.js';
import Rider from '../models/Rider.js';

// ✅ Admin: Assign delivery to rider
export const assignDelivery = async (req, res) => {
  try {
    const { orderId, riderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const rider = await Rider.findById(riderId);
    if (!rider || rider.status !== 'online') {
      return res.status(400).json({ message: 'Rider not available' });
    }

    const delivery = await Delivery.create({
      orderId,
      riderId,
      status: 'assigned'
    });

    order.deliveryStatus = 'assigned';
    order.riderId = riderId;
    await order.save();

    rider.status = 'busy';
    await rider.save();

    const io = req.app.get('io');
    io.emit('new-delivery-assigned', { orderId, riderId });
    // ✅ Also emit order-updated so customer sees "assigned"
    io.emit('order-updated', order);

    res.status(201).json({ success: true, delivery });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Rider: Accept delivery
export const acceptDelivery = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const riderId = req.user.id;

    const delivery = await Delivery.findById(deliveryId);
    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }

    if (delivery.riderId.toString() !== riderId) {
      return res.status(403).json({ message: 'Not assigned to you' });
    }

    delivery.status = 'accepted';
    await delivery.save();

    // ✅ Get updated order to emit
    const updatedOrder = await Order.findByIdAndUpdate(
      delivery.orderId,
      { deliveryStatus: 'accepted' },
      { new: true }
    );

    const io = req.app.get('io');
    io.emit('delivery-status-update', { deliveryId, status: 'accepted' });
    io.emit('order-updated', updatedOrder);  // 🔥 FIXED

    res.json({ success: true, delivery });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Rider: Mark as picked up
export const pickUpDelivery = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const delivery = await Delivery.findById(deliveryId);
    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }

    delivery.status = 'picked_up';
    delivery.pickupTime = new Date();
    await delivery.save();

    // ✅ Get updated order to emit
    const updatedOrder = await Order.findByIdAndUpdate(
      delivery.orderId,
      { deliveryStatus: 'picked_up' },
      { new: true }
    );

    const io = req.app.get('io');
    io.emit('delivery-status-update', { deliveryId, status: 'picked_up' });
    io.emit('order-updated', updatedOrder);  // 🔥 FIXED

    res.json({ success: true, delivery });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Rider: Mark as on the way (start live tracking)
export const startDelivery = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const delivery = await Delivery.findById(deliveryId);
    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }

    delivery.status = 'on_way';
    await delivery.save();

    // ✅ Get updated order to emit
    const updatedOrder = await Order.findByIdAndUpdate(
      delivery.orderId,
      { deliveryStatus: 'on_way' },
      { new: true }
    );

    const io = req.app.get('io');
    io.emit('delivery-status-update', { deliveryId, status: 'on_way' });
    io.emit('order-updated', updatedOrder);  // 🔥 FIXED

    res.json({ success: true, delivery });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Rider: Mark as delivered
export const completeDelivery = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const delivery = await Delivery.findById(deliveryId);
    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }

    delivery.status = 'delivered';
    delivery.deliveryTime = new Date();
    await delivery.save();

    // ✅ Get updated order (also sets order.status to 'Completed')
    const updatedOrder = await Order.findByIdAndUpdate(
      delivery.orderId,
      {
        deliveryStatus: 'delivered',
        status: 'Completed'
      },
      { new: true }
    );

    // Update rider stats
    await Rider.findByIdAndUpdate(delivery.riderId, {
      $inc: { totalDeliveries: 1, earnings: 50 },
      status: 'online'
    });

    const io = req.app.get('io');
    io.emit('delivery-status-update', { deliveryId, status: 'delivered' });
    io.emit('order-updated', updatedOrder);  // 🔥 FIXED

    res.json({ success: true, delivery });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get deliveries for a rider
export const getRiderDeliveries = async (req, res) => {
  try {
    const riderId = req.user.id;
    const deliveries = await Delivery.find({ riderId })
      .populate('orderId', 'orderNumber customerName totalAmount address')
      .sort({ createdAt: -1 });
    res.json(deliveries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Admin: Get all deliveries
export const getAllDeliveries = async (req, res) => {
  try {
    const deliveries = await Delivery.find()
      .populate('orderId', 'orderNumber customerName totalAmount')
      .populate('riderId', 'name phone')
      .sort({ createdAt: -1 });
    res.json(deliveries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get delivery by order ID (for customer tracking)
export const getDeliveryByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const delivery = await Delivery.findOne({ orderId })
      .populate('riderId', 'name phone rating location');
    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }
    res.json(delivery);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Update location history (rider pushes location)
export const updateLocationHistory = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { lat, lng } = req.body;

    const delivery = await Delivery.findById(deliveryId);
    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found' });
    }

    delivery.locationHistory.push({ lat, lng });
    await delivery.save();

    // Also update rider location
    await Rider.findByIdAndUpdate(delivery.riderId, {
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      }
    });

    const io = req.app.get('io');
    io.to(`order-${delivery.orderId}`).emit('rider-location-update', { lat, lng });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};