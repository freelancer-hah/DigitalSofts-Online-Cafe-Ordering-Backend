import mongoose from 'mongoose';

const riderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  vehicleType: { 
    type: String, 
    enum: ['bike', 'car', 'scooter'], 
    default: 'bike' 
  },
  status: { 
    type: String, 
    enum: ['online', 'offline', 'busy'], 
    default: 'offline' 
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
  },
  rating: { type: Number, default: 0 },
  totalDeliveries: { type: Number, default: 0 },
  earnings: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Create 2dsphere index for location queries
riderSchema.index({ location: '2dsphere' });

export default mongoose.model('Rider', riderSchema);