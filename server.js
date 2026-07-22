import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import menuRoutes from './routes/menuRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import userRoutes from './routes/userRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import churnRoutes from './routes/churnRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import visionRoutes from './routes/visionRoutes.js';
import forecastRoutes from './routes/forecastRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import chatRoutes from './routes/chatRoutes.js';

// ✅ NEW delivery imports
import riderRoutes from './routes/riderRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';

import { startCartRecoveryScheduler } from './utils/cartRecovery.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const server = http.createServer(app);

// Timeouts
server.timeout = 60000;
server.keepAliveTimeout = 65000;

const allowedOrigins = [
  process.env.CLIENT_URL,
  'https://elegant-maamoul-bfaab7.netlify.app',
 ' https://digital-softs-online-cafe-ordering-lemon.vercel.app/',
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean);

console.log('✅ Allowed origins:', allowedOrigins);

// CORS
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.log('❌ Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Socket.io
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});
app.set('io', io);

// Socket events for delivery real-time tracking
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Customer joins room to track delivery
  socket.on('track-order', (orderId) => {
    socket.join(`order-${orderId}`);
    console.log(`Socket ${socket.id} joined room order-${orderId}`);
  });

  socket.on('leave-order', (orderId) => {
    socket.leave(`order-${orderId}`);
  });

  // Rider sends location update (alternative to HTTP)
  socket.on('rider-location', (data) => {
    const { orderId, lat, lng } = data;
    io.to(`order-${orderId}`).emit('rider-location-update', { lat, lng });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Middleware
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/churn', churnRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/chat', chatRoutes);

// ✅ NEW delivery routes
app.use('/api/riders', riderRoutes);
app.use('/api/deliveries', deliveryRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({ message: 'Something went wrong' });
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`✅ Allowed origins:`, allowedOrigins);
    });
    startCartRecoveryScheduler();
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });