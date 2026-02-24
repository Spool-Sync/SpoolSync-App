import { Router } from 'express';
import * as spoolHolderController from '../controllers/spoolHolderController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('spool_holders:create'), spoolHolderController.create);
router.get('/', requirePermission('spool_holders:view'), spoolHolderController.list);
router.get('/:spoolHolderId', requirePermission('spool_holders:view'), spoolHolderController.getOne);
router.put('/:spoolHolderId', requirePermission('spool_holders:edit'), spoolHolderController.update);
router.delete('/:spoolHolderId', requirePermission('spool_holders:delete'), spoolHolderController.remove);
router.post('/:spoolHolderId/calibrate', requirePermission('spool_holders:edit'), spoolHolderController.calibrate);
router.post('/:spoolHolderId/update-sensor-data', requirePermission('spool_holders:edit'), spoolHolderController.updateSensorData);

export default router;
