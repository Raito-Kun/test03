import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import * as clusterCtrl from '../controllers/cluster-controller';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('super_admin'));

router.get('/', clusterCtrl.listClusters);
router.get('/active', clusterCtrl.getActiveCluster);
router.get('/:id', clusterCtrl.getCluster);
router.post('/', clusterCtrl.createCluster);
router.put('/:id', clusterCtrl.updateCluster);
router.delete('/:id', clusterCtrl.deleteCluster);
router.post('/:id/switch', clusterCtrl.switchCluster);
router.post('/:id/test-connection', clusterCtrl.testConnection);

export default router;
