import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import * as ctrl from '../controllers/macro-controller';

const router = Router();

router.use(authMiddleware);

router.get('/', ctrl.listMacros);
router.post('/', ctrl.createMacro);
router.patch('/:id', ctrl.updateMacro);
router.delete('/:id', ctrl.deleteMacro);

export default router;
