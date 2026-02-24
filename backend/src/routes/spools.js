import { Router } from 'express';
import * as spoolController from '../controllers/spoolController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('spools:create'), spoolController.create);
router.get('/', requirePermission('spools:view'), spoolController.list);
router.get('/filters', requirePermission('spools:view'), spoolController.listFilters);
router.get('/usage-trend', requirePermission('spools:view'), spoolController.getUsageTrend);
router.get('/usage-trend-by-type', requirePermission('spools:view'), spoolController.getUsageTrendByType);
router.get('/by-nfc/:nfcTagId', requirePermission('spools:view'), spoolController.findByNfcTag);
router.get('/:spoolId', requirePermission('spools:view'), spoolController.getOne);
router.get('/:spoolId/history', requirePermission('spools:view'), spoolController.getHistory);
router.put('/:spoolId', requirePermission('spools:edit'), spoolController.update);
router.delete('/:spoolId', requirePermission('spools:delete'), spoolController.remove);
router.put('/:spoolId/associate-location', requirePermission('spools:edit'), spoolController.associateLocation);
router.put('/:spoolId/update-weight', requirePermission('spools:edit'), spoolController.updateWeight);
router.put('/:spoolId/update-status', requirePermission('spools:edit'), spoolController.updateStatus);
router.post('/:spoolId/link-nfc', requirePermission('spools:edit'), spoolController.linkNfcTag);
router.post('/:spoolId/mark-spent', requirePermission('spools:edit'), spoolController.markSpent);
router.post('/:spoolId/refill', requirePermission('spools:edit'), spoolController.refill);

export default router;
