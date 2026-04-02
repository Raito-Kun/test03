import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requirePermission } from '../middleware/rbac-middleware';
import { allocateEntities, getAssignableAgents } from '../controllers/data-allocation-controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/v1/data-allocation/agents — list assignable agents
router.get('/agents', requirePermission('crm.data_allocation'), getAssignableAgents);

// POST /api/v1/data-allocation/allocate — assign entities to user
router.post('/allocate', requirePermission('crm.data_allocation'), allocateEntities);

export default router;
