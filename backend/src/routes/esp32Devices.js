import { Router } from 'express';
import * as esp32DeviceController from '../controllers/esp32DeviceController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Unauthenticated: ESP32 devices cannot send JWT tokens
router.post('/report', esp32DeviceController.report);

router.use(authenticate);

router.get('/', esp32DeviceController.list);
router.post('/', esp32DeviceController.create);
router.get('/:deviceId', esp32DeviceController.getOne);
router.put('/:deviceId', esp32DeviceController.update);
router.delete('/:deviceId', esp32DeviceController.remove);

export default router;
