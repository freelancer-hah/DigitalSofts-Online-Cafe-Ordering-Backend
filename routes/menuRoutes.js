import express from "express";
import {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} from "../controllers/menuController.js";
import { protectAdmin } from "../middleware/auth.js";

const router = express.Router();

router.get("/", getMenuItems);
router.post("/", protectAdmin, createMenuItem);
router.put("/:id", protectAdmin, updateMenuItem);
router.delete("/:id", protectAdmin, deleteMenuItem);

export default router;
