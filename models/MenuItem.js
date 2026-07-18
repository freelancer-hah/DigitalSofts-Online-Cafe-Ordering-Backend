import mongoose from "mongoose";

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      required: true,
      enum: ["Starters", "Main Course", "Beverages", "Desserts", "Fast Food"],
    },
    image: { type: String, default: "" },
    imagePublicId: { type: String, default: "" }, // ✅ For Cloudinary management
    available: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("MenuItem", menuItemSchema);