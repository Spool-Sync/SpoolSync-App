import { Router } from 'express';
import * as integrationController from '../controllers/integrationController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import multer from 'multer';

const upload = multer({ dest: 'uploads/integrations/' });
const router = Router();

router.use(authenticate);

router.get('/types', requirePermission('settings:view'), integrationController.listTypes);
router.post('/upload-config', requirePermission('settings:edit'), upload.single('config'), integrationController.uploadConfig);
router.get('/:typeId/status', requirePermission('settings:view'), integrationController.getTypeStatus);

export default router;
