import { Router } from 'express';
import * as spoolHolderController from '../controllers/spoolHolderController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/', spoolHolderController.create);
router.get('/', spoolHolderController.list);
router.get('/:spoolHolderId', spoolHolderController.getOne);
router.put('/:spoolHolderId', spoolHolderController.update);
router.delete('/:spoolHolderId', spoolHolderController.remove);
router.post('/:spoolHolderId/calibrate', spoolHolderController.calibrate);
router.post('/:spoolHolderId/update-sensor-data', spoolHolderController.updateSensorData);

export default router;
