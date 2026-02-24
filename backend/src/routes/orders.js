import { Router } from 'express';
import * as orderController from '../controllers/orderController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission('orders:create'), orderController.create);
router.get('/', requirePermission('orders:view'), orderController.list);
router.get('/:orderId', requirePermission('orders:view'), orderController.getOne);
router.put('/:orderId', requirePermission('orders:edit'), orderController.update);
router.delete('/:orderId', requirePermission('orders:delete'), orderController.remove);
router.post('/trigger-reorder', requirePermission('orders:create'), orderController.triggerReorder);

export default router;
