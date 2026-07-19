import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 }
}, { _id: false });

const cartSchema = new mongoose.Schema({
  customerName: { type: String, default: '' },
  customerEmail: { type: String, default: '' },
  customerPhone: { type: String, default: '' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: { type: [cartItemSchema], default: [] },
  totalAmount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['active', 'abandoned', 'recovered', 'completed'],
    default: 'active'
  },
  recoveryAttempts: { type: Number, default: 0 },
  lastRecoveryEmail: { type: Date },
  abandonedAt: { type: Date },
  recoveredAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Auto-update updatedAt
cartSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Cart', cartSchema);