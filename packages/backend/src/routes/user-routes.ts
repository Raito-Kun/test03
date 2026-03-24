import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import * as userCtrl from '../controllers/user-controller';

const router = Router();

// All routes require auth
router.use(authMiddleware);

router.get('/', requireRole('admin', 'manager'), userCtrl.listUsers);
router.post('/', requireRole('admin'), userCtrl.createUser);
router.get('/:id', requireRole('admin', 'manager'), userCtrl.getUser);
router.patch('/:id', requireRole('admin'), userCtrl.updateUser);
router.delete('/:id', requireRole('admin'), userCtrl.deleteUser);

export default router;
