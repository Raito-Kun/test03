import { Router } from 'express';
import { loginHandler, refreshHandler, logoutHandler, meHandler, updateMeHandler } from '../controllers/auth-controller';
import { authMiddleware } from '../middleware/auth-middleware';
import { loginLimiter } from '../middleware/rate-limiter';

const router = Router();

router.post('/login', loginLimiter, loginHandler);
router.post('/refresh', refreshHandler);
router.post('/logout', authMiddleware, logoutHandler);
router.get('/me', authMiddleware, meHandler);
router.patch('/me', authMiddleware, updateMeHandler);

export default router;
