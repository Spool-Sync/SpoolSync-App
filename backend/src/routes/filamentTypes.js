import { Router } from 'express';
import * as filamentTypeController from '../controllers/filamentTypeController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/brands', filamentTypeController.listBrands);
router.get('/material-types', filamentTypeController.listMaterialTypes);
router.get('/materials', filamentTypeController.listMaterials);
router.post('/', filamentTypeController.create);
router.get('/', filamentTypeController.list);
router.get('/search', filamentTypeController.search);
router.post('/sync-external', filamentTypeController.syncExternal);
router.get('/:id', filamentTypeController.getOne);
router.put('/:id', filamentTypeController.update);
router.delete('/:id', filamentTypeController.remove);

export default router;
