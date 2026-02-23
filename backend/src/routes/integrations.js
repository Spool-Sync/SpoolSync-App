import { Router } from 'express';
import * as integrationController from '../controllers/integrationController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import multer from 'multer';

const upload = multer({ dest: 'uploads/integrations/' });
const router = Router();

router.use(authenticate);

router.get('/types', integrationController.listTypes);
router.post('/upload-config', requireRole('ADMIN'), upload.single('config'), integrationController.uploadConfig);
router.get('/:typeId/status', integrationController.getTypeStatus);

export default router;
