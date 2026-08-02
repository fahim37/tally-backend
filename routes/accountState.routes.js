import { Router } from 'express';
import requireAuth from '../middlewares/auth.js';
import { get, sync } from '../controllers/accountState.controller.js';

const router = Router();

router.get('/sync', requireAuth, get);
router.patch('/sync', requireAuth, sync);

export default router;
