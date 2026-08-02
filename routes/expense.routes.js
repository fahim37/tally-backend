import { Router } from 'express';
import requireAuth from '../middlewares/auth.js';
import { list, sync } from '../controllers/expense.controller.js';

const router = Router();

router.get('/sync', requireAuth, list);
router.post('/sync', requireAuth, sync);

export default router;
