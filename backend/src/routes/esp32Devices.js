import { Router } from 'express';
import * as esp32DeviceController from '../controllers/esp32DeviceController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// Unauthenticated: ESP32 devices cannot send JWT tokens
router.post('/report', esp32DeviceController.report);

router.use(authenticate);

router.get('/', requirePermission('esp32_devices:view'), esp32DeviceController.list);
router.post('/', requirePermission('esp32_devices:create'), esp32DeviceController.create);
router.get('/:deviceId', requirePermission('esp32_devices:view'), esp32DeviceController.getOne);
router.put('/:deviceId', requirePermission('esp32_devices:edit'), esp32DeviceController.update);
router.delete('/:deviceId', requirePermission('esp32_devices:delete'), esp32DeviceController.remove);

export default router;
