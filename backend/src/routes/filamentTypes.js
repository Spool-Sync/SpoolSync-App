import { Router } from 'express';
import * as filamentTypeController from '../controllers/filamentTypeController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/brands', requirePermission('filament_types:view'), filamentTypeController.listBrands);
router.get('/material-types', requirePermission('filament_types:view'), filamentTypeController.listMaterialTypes);
router.get('/materials', requirePermission('filament_types:view'), filamentTypeController.listMaterials);
router.post('/', requirePermission('filament_types:create'), filamentTypeController.create);
router.get('/', requirePermission('filament_types:view'), filamentTypeController.list);
router.get('/search', requirePermission('filament_types:view'), filamentTypeController.search);
router.post('/sync-external', requirePermission('filament_types:create'), filamentTypeController.syncExternal);
router.get('/:id', requirePermission('filament_types:view'), filamentTypeController.getOne);
router.put('/:id', requirePermission('filament_types:edit'), filamentTypeController.update);
router.delete('/:id', requirePermission('filament_types:delete'), filamentTypeController.remove);

export default router;
