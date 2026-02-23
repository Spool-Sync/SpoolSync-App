import { Router } from 'express';
import * as printerController from '../controllers/printerController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/', printerController.create);
router.get('/', printerController.list);
router.get('/:printerId', printerController.getOne);
router.put('/:printerId', printerController.update);
router.delete('/:printerId', printerController.remove);
router.post('/:printerId/sync-status', printerController.syncStatus);
router.post('/:printerId/reload-filaments', printerController.reloadFilaments);
router.put('/:printerId/spool-holder-count', printerController.setSpoolHolderCount);
router.get('/:printerId/print-jobs', printerController.getPrintJobs);
router.post('/:printerId/associate-spoolholder', printerController.associateSpoolHolder);
router.delete('/:printerId/associate-spoolholder', printerController.dissociateSpoolHolder);

// Holder-specific operations (nested under printer for clarity)
router.put('/holders/:spoolHolderId/configure', printerController.configureHolder);
router.put('/holders/:spoolHolderId/assign-spool', printerController.assignSpool);
router.delete('/holders/:spoolHolderId/assign-spool', printerController.removeSpool);

export default router;
