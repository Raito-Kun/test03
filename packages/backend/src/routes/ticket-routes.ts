import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import * as ctrl from '../controllers/ticket-controller';

const router = Router();

router.use(authMiddleware);

router.get('/', ctrl.listTickets);
router.post('/', ctrl.createTicket);
router.get('/:id', ctrl.getTicket);
router.patch('/:id', ctrl.updateTicket);
router.delete('/:id', ctrl.deleteTicket);

export default router;
