import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import * as ctrl from '../controllers/notification-controller';

const router = Router();

router.use(authMiddleware);

router.get('/', ctrl.listNotifications);
router.patch('/read-all', ctrl.markAllAsRead);
router.patch('/:id/read', ctrl.markAsRead);

export default router;
