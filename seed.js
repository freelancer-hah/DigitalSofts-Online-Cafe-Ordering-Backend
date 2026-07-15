// Seeds the database with sample menu items and a default admin account.
// Run with: npm run seed

import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import MenuItem from "./models/MenuItem.js";
import Admin from "./models/Admin.js";

dotenv.config();

const menuItems = [
  {
    name: "Chicken Broast",
    description: "Crispy fried chicken pieces served with fries and dip",
    price: 850,
    category: "Fast Food",
    image: "",
  },
  {
    name: "Zinger Burger",
    description: "Crispy chicken fillet burger with mayo and lettuce",
    price: 450,
    category: "Fast Food",
    image: "",
  },
  {
    name: "Chicken Karahi (Half)",
    description: "Traditional spicy chicken karahi, half portion",
    price: 950,
    category: "Main Course",
    image: "",
  },
  {
    name: "Beef Biryani",
    description: "Fragrant basmati rice cooked with tender beef and spices",
    price: 380,
    category: "Main Course",
    image: "",
  },
  {
    name: "Seekh Kebab (6 pcs)",
    description: "Grilled minced beef skewers with mint chutney",
    price: 600,
    category: "Starters",
    image: "",
  },
  {
    name: "Spring Rolls (6 pcs)",
    description: "Crispy vegetable spring rolls with sweet chili sauce",
    price: 350,
    category: "Starters",
    image: "",
  },
  {
    name: "Kashmiri Chai",
    description: "Pink tea with pistachio and almond garnish",
    price: 200,
    category: "Beverages",
    image: "",
  },
  {
    name: "Fresh Lime Soda",
    description: "Chilled lime soda, sweet or salted",
    price: 180,
    category: "Beverages",
    image: "",
  },
  {
    name: "Chocolate Lava Cake",
    description: "Warm chocolate cake with a molten center, served with ice cream",
    price: 420,
    category: "Desserts",
    image: "",
  },
  {
    name: "Gulab Jamun (4 pcs)",
    description: "Soft milk-solid dumplings soaked in sugar syrup",
    price: 250,
    category: "Desserts",
    image: "",
  },
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected for seeding");

    await MenuItem.deleteMany();
    await MenuItem.insertMany(menuItems);
    console.log(`Seeded ${menuItems.length} menu items`);

    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    await Admin.deleteMany({ username: adminUsername });
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await Admin.create({ username: adminUsername, password: hashedPassword });
    console.log(`Seeded admin account -> username: ${adminUsername}, password: ${adminPassword}`);

    console.log("Seeding complete.");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err.message);
    process.exit(1);
  }
};

seedDatabase();
