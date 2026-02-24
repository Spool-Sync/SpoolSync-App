import { Router } from 'express';
import * as storageLocationController from '../controllers/storageLocationController.js';
import * as storageZoneController from '../controllers/storageZoneController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('storage:create'), storageLocationController.create);
router.get('/', requirePermission('storage:view'), storageLocationController.list);
router.get('/:locationId', requirePermission('storage:view'), storageLocationController.getOne);
router.put('/:locationId', requirePermission('storage:edit'), storageLocationController.update);
router.delete('/:locationId', requirePermission('storage:delete'), storageLocationController.remove);
router.post('/:locationId/link-spool', requirePermission('storage:edit'), storageLocationController.linkSpool);
router.delete('/:locationId/unlink-spool', requirePermission('storage:edit'), storageLocationController.unlinkSpool);

// Zone sub-routes
router.get('/:locationId/zones', requirePermission('storage:view'), storageZoneController.list);
router.post('/:locationId/zones', requirePermission('storage:create'), storageZoneController.create);
router.put('/zones/:zoneId', requirePermission('storage:edit'), storageZoneController.update);
router.delete('/zones/:zoneId', requirePermission('storage:delete'), storageZoneController.remove);
router.post('/zones/:zoneId/assign-spool', requirePermission('storage:edit'), storageZoneController.assignSpool);
router.delete('/zones/:zoneId/remove-spool', requirePermission('storage:edit'), storageZoneController.removeSpool);

export default router;
