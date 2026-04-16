import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import * as featureFlagCtrl from '../controllers/feature-flag-controller';

const router = Router();
router.use(authMiddleware);

// All authenticated users can read effective flags (needed for sidebar)
router.get('/effective', featureFlagCtrl.getEffectiveFlags);

// Only super_admin can manage feature flags
router.get('/', requireRole('super_admin'), featureFlagCtrl.getFlags);
router.put('/', requireRole('super_admin'), featureFlagCtrl.bulkUpdateFlags);

export default router;
