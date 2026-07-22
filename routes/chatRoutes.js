import express from 'express';
import { chatWithBot, getQuickMenu } from '../controllers/chatController.js';

const router = express.Router();

router.post('/ask', chatWithBot);
router.get('/menu', getQuickMenu);

export default router;