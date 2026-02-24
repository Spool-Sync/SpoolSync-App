import { Router } from 'express';
import * as printerController from '../controllers/printerController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('printers:create'), printerController.create);
router.get('/', requirePermission('printers:view'), printerController.list);
router.get('/:printerId', requirePermission('printers:view'), printerController.getOne);
router.put('/:printerId', requirePermission('printers:edit'), printerController.update);
router.delete('/:printerId', requirePermission('printers:delete'), printerController.remove);
router.post('/:printerId/sync-status', requirePermission('printers:view'), printerController.syncStatus);
router.post('/:printerId/reload-filaments', requirePermission('printers:edit'), printerController.reloadFilaments);
router.put('/:printerId/spool-holder-count', requirePermission('printers:edit'), printerController.setSpoolHolderCount);
router.get('/:printerId/print-jobs', requirePermission('printers:view'), printerController.getPrintJobs);
router.post('/:printerId/associate-spoolholder', requirePermission('printers:edit'), printerController.associateSpoolHolder);
router.delete('/:printerId/associate-spoolholder', requirePermission('printers:edit'), printerController.dissociateSpoolHolder);

// Holder-specific operations (nested under printer for clarity)
router.put('/holders/:spoolHolderId/configure', requirePermission('spool_holders:edit'), printerController.configureHolder);
router.put('/holders/:spoolHolderId/assign-spool', requirePermission('spool_holders:edit'), printerController.assignSpool);
router.delete('/holders/:spoolHolderId/assign-spool', requirePermission('spool_holders:edit'), printerController.removeSpool);

export default router;
