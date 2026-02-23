import { Router } from 'express';
import * as spoolController from '../controllers/spoolController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/', spoolController.create);
router.get('/', spoolController.list);
router.get('/filters', spoolController.listFilters);
router.get('/usage-trend', spoolController.getUsageTrend);
router.get('/usage-trend-by-type', spoolController.getUsageTrendByType);
router.get('/by-nfc/:nfcTagId', spoolController.findByNfcTag);
router.get('/:spoolId', spoolController.getOne);
router.get('/:spoolId/history', spoolController.getHistory);
router.put('/:spoolId', spoolController.update);
router.delete('/:spoolId', spoolController.remove);
router.put('/:spoolId/associate-location', spoolController.associateLocation);
router.put('/:spoolId/update-weight', spoolController.updateWeight);
router.put('/:spoolId/update-status', spoolController.updateStatus);
router.post('/:spoolId/link-nfc', spoolController.linkNfcTag);
router.post('/:spoolId/mark-spent', spoolController.markSpent);
router.post('/:spoolId/refill', spoolController.refill);

export default router;
