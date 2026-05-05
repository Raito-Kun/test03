import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import * as teamCtrl from '../controllers/team-controller';
import { checkFeatureEnabled } from '../middleware/feature-flag-middleware';

const router = Router();

router.use(authMiddleware);
router.use(checkFeatureEnabled('team_management'));

router.get('/', teamCtrl.listTeams);
router.post('/', requireRole('super_admin', 'admin', 'manager'), teamCtrl.createTeam);
router.patch('/:id', requireRole('super_admin', 'admin', 'manager'), teamCtrl.updateTeam);
router.delete('/:id', requireRole('super_admin', 'admin'), teamCtrl.deleteTeam);
router.get('/:id/members', teamCtrl.getTeamMembers);

export default router;
