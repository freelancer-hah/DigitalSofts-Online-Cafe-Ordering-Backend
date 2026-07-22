import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';
import User from '../models/User.js';
import Rider from '../models/Rider.js'; // ✅ Import Rider

// Admin Login (unchanged)
export const loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(401).json({ message: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, username: admin.username, role: 'admin' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ✅ Unified Login — checks User, then Rider, then Admin
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // 1️⃣ Check Customer
    let user = await User.findOne({ email });
    if (user) {
      const isMatch = await user.comparePassword(password);
      if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
      if (!user.isActive) return res.status(403).json({ message: 'Account is deactivated' });
      const token = jwt.sign(
        { id: user._id, email: user.email, role: 'customer' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: 'customer'
        }
      });
    }

    // 2️⃣ Check Rider
    const rider = await Rider.findOne({ email });
    if (rider) {
      const isMatch = await bcrypt.compare(password, rider.password);
      if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
      if (!rider.isActive) return res.status(403).json({ message: 'Account is deactivated' });
      const token = jwt.sign(
        { id: rider._id, email: rider.email, role: 'rider' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({
        token,
        user: {
          id: rider._id,
          name: rider.name,
          email: rider.email,
          phone: rider.phone,
          role: 'rider'
        }
      });
    }

    // 3️⃣ Check Admin (optional, if you want admin login via same endpoint)
    const admin = await Admin.findOne({ username: email });
    if (admin) {
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
      const token = jwt.sign(
        { id: admin._id, username: admin.username, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({
        token,
        user: {
          id: admin._id,
          name: admin.username,
          email: admin.username,
          role: 'admin'
        }
      });
    }

    // No user found
    return res.status(401).json({ message: 'Invalid credentials' });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message });
  }
};

// User Registration (unchanged)
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const user = await User.create({ name, email, password, phone, role: 'customer' });
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Current User (unchanged)
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};