import { Router } from 'express';
import requireAuth from '../middlewares/auth.js';
import { sync } from '../controllers/expense.controller.js';

const router = Router();

router.post('/sync', requireAuth, sync);

export default router;
