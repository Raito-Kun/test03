import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requirePermission } from '../middleware/rbac-middleware';
import * as ctrl from '../controllers/ticket-controller';
import { checkFeatureEnabled } from '../middleware/feature-flag-middleware';

const router = Router();

router.use(authMiddleware);
router.use(checkFeatureEnabled('tickets'));

router.get('/', ctrl.listTickets);
router.post('/', ctrl.createTicket);
router.get('/:id', ctrl.getTicket);
router.patch('/:id', ctrl.updateTicket);
router.delete('/:id', requirePermission('ticket.delete'), ctrl.deleteTicket);

export default router;
