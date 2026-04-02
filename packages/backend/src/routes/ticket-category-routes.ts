import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import * as ctrl from '../controllers/ticket-category-controller';

const router = Router();

router.use(authMiddleware);

router.get('/', ctrl.listCategories);
router.post('/', requireRole('super_admin', 'admin', 'manager'), ctrl.createCategory);
router.patch('/:id', requireRole('super_admin', 'admin', 'manager'), ctrl.updateCategory);
router.delete('/:id', requireRole('super_admin', 'admin', 'manager'), ctrl.deleteCategory);

export default router;
