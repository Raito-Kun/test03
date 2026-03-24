import { Router } from 'express';
import * as ctrl from '../controllers/webhook-controller';

const router = Router();

// Raw text body for XML parsing
router.post('/cdr', ctrl.handleCdr);

export default router;
