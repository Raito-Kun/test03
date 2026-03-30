import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import { listExtensionsHandler, assignExtensionHandler } from '../controllers/extension-controller';

const router = Router();

router.use(authMiddleware);

router.get('/', requireRole('admin', 'super_admin'), listExtensionsHandler);
router.put('/:ext/assign', requireRole('admin', 'super_admin'), assignExtensionHandler);

export default router;
