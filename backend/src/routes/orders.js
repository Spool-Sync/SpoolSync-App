import { Router } from 'express';
import * as orderController from '../controllers/orderController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.post('/', orderController.create);
router.get('/', orderController.list);
router.get('/:orderId', orderController.getOne);
router.put('/:orderId', orderController.update);
router.delete('/:orderId', orderController.remove);
router.post('/trigger-reorder', orderController.triggerReorder);

export default router;
