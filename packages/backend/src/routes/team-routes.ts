import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import * as teamCtrl from '../controllers/team-controller';

const router = Router();

router.use(authMiddleware);

router.get('/', teamCtrl.listTeams);
router.post('/', requireRole('admin', 'manager'), teamCtrl.createTeam);
router.patch('/:id', requireRole('admin', 'manager'), teamCtrl.updateTeam);
router.delete('/:id', requireRole('admin'), teamCtrl.deleteTeam);
router.get('/:id/members', teamCtrl.getTeamMembers);

export default router;
