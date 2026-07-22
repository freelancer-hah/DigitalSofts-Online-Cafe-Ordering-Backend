import mongoose from 'mongoose';

const deliverySchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  riderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider' },
  status: {
    type: String,
    enum: ['assigned', 'accepted', 'picked_up', 'on_way', 'delivered', 'cancelled'],
    default: 'assigned'
  },
  pickupTime: { type: Date },
  deliveryTime: { type: Date },
  locationHistory: [
    {
      lat: { type: Number },
      lng: { type: Number },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  customerRating: { type: Number, min: 1, max: 5 },
  riderRating: { type: Number, min: 1, max: 5 },
  distance: { type: Number }, // in km
  estimatedTime: { type: Number }, // in minutes
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Auto-update updatedAt
deliverySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Delivery', deliverySchema);