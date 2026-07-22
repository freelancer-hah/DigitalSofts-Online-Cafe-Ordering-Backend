import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customerName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    orderType: {
      type: String,
      enum: ["Delivery", "Pickup"],
      default: "Pickup",
    },
    items: { type: [orderItemSchema], required: true },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Pending", "Preparing", "Ready", "Completed", "Cancelled"],
      default: "Pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending"
    },
    paymentId: { type: String, default: "" },
    refundId: { type: String, default: "" },
    refundReason: { type: String, default: "" },
    cancelledAt: { type: Date },
    cancelReason: { type: String, default: "" },
    notes: { type: String, default: "" },

    // ✅ New delivery fields
    deliveryStatus: {
      type: String,
      enum: ['pending', 'assigned', 'accepted', 'picked_up', 'on_way', 'delivered'],
      default: 'pending'
    },
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rider' },
    deliveryAddress: {
      street: { type: String, default: '' },
      area: { type: String, default: '' },
      city: { type: String, default: '' },
      landmark: { type: String, default: '' },
      coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
    },
    deliveryDistance: { type: Number }, // in km
    deliveryEstimate: { type: Number } // in minutes
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);