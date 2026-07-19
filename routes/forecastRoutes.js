import express from 'express';
import { getSalesForecast, getSimpleForecast } from '../controllers/forecastController.js';
import { protectAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/sales', protectAdmin, getSalesForecast);
router.get('/simple', protectAdmin, getSimpleForecast);

export default router;