import Rider from '../models/Rider.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ✅ Register a new rider (Admin only)
export const createRider = async (req, res) => {
  try {
    const { name, email, password, phone, vehicleType } = req.body;

    const existingRider = await Rider.findOne({ email });
    if (existingRider) {
      return res.status(400).json({ message: 'Rider already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const rider = await Rider.create({
      name,
      email,
      password: hashedPassword,
      phone,
      vehicleType
    });

    res.status(201).json({ success: true, rider });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Rider login
export const loginRider = async (req, res) => {
  try {
    const { email, password } = req.body;

    const rider = await Rider.findOne({ email });
    if (!rider) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, rider.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: rider._id, role: 'rider' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      rider: {
        id: rider._id,
        name: rider.name,
        email: rider.email,
        phone: rider.phone,
        status: rider.status,
        rating: rider.rating,
        totalDeliveries: rider.totalDeliveries,
        earnings: rider.earnings
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get rider profile
export const getRiderProfile = async (req, res) => {
  try {
    const rider = await Rider.findById(req.user.id).select('-password');
    res.json(rider);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Update rider status (online/offline/busy)
export const updateRiderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const rider = await Rider.findByIdAndUpdate(
      req.user.id,
      { status },
      { new: true }
    ).select('-password');
    res.json(rider);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Update rider location (for live tracking)
export const updateRiderLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const rider = await Rider.findByIdAndUpdate(
      req.user.id,
      {
        location: {
          type: 'Point',
          coordinates: [lng, lat]
        }
      },
      { new: true }
    ).select('-password');
    res.json(rider);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Admin: Get all riders
export const getAllRiders = async (req, res) => {
  try {
    const riders = await Rider.find().select('-password');
    res.json(riders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Admin: Get rider by ID
export const getRiderById = async (req, res) => {
  try {
    const rider = await Rider.findById(req.params.id).select('-password');
    if (!rider) {
      return res.status(404).json({ message: 'Rider not found' });
    }
    res.json(rider);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Admin: Delete rider
export const deleteRider = async (req, res) => {
  try {
    await Rider.findByIdAndDelete(req.params.id);
    res.json({ message: 'Rider deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};