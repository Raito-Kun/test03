import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { requireRole } from '../middleware/rbac-middleware';
import * as clusterCtrl from '../controllers/cluster-controller';
import * as userCtrl from '../controllers/user-controller';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('super_admin', 'admin'));

router.get('/', clusterCtrl.listClusters);
router.get('/active', clusterCtrl.getActiveCluster);
router.post('/', clusterCtrl.createCluster);
router.post('/ssh-discover', clusterCtrl.sshDiscover);
router.post('/test-connection-direct', clusterCtrl.testConnectionDirect);
router.get('/:id', clusterCtrl.getCluster);
router.put('/:id', clusterCtrl.updateCluster);
router.delete('/:id', clusterCtrl.deleteCluster);
router.post('/:id/switch', clusterCtrl.switchCluster);
router.post('/:id/test-connection', clusterCtrl.testConnection);
router.post('/:id/sync-extensions', clusterCtrl.syncExtensions);
router.get('/:id/extensions', clusterCtrl.listExtensions);
router.post('/:id/preflight', clusterCtrl.clusterPreflight);
router.get('/:id/dialplans', clusterCtrl.clusterDialplans);

// Cluster account management
router.get('/:id/accounts', userCtrl.listClusterAccounts);
router.post('/:id/accounts', userCtrl.createClusterAccount);
router.post('/:id/accounts/import-csv', userCtrl.importClusterAccountsCsv);
router.post('/:id/accounts/:userId/change-password', userCtrl.changeClusterAccountPassword);
router.patch('/:id/accounts/:userId/status', userCtrl.toggleClusterAccountStatus);
router.delete('/:id/accounts/:userId', userCtrl.deleteClusterAccount);

export default router;
