import { Router } from 'express';
import * as storageLocationController from '../controllers/storageLocationController.js';
import * as storageZoneController from '../controllers/storageZoneController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/', storageLocationController.create);
router.get('/', storageLocationController.list);
router.get('/:locationId', storageLocationController.getOne);
router.put('/:locationId', storageLocationController.update);
router.delete('/:locationId', storageLocationController.remove);
router.post('/:locationId/link-spool', storageLocationController.linkSpool);
router.delete('/:locationId/unlink-spool', storageLocationController.unlinkSpool);

// Zone sub-routes
router.get('/:locationId/zones', storageZoneController.list);
router.post('/:locationId/zones', storageZoneController.create);
router.put('/zones/:zoneId', storageZoneController.update);
router.delete('/zones/:zoneId', storageZoneController.remove);
router.post('/zones/:zoneId/assign-spool', storageZoneController.assignSpool);
router.delete('/zones/:zoneId/remove-spool', storageZoneController.removeSpool);

export default router;
