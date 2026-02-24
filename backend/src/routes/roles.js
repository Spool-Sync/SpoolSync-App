import { Router } from 'express';
import * as rolesController from '../controllers/rolesController.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { PERMISSION_GROUPS } from '../utils/permissions.js';

const router = Router();

router.use(authenticate);

// Permission catalogue — no extra permission required beyond being authenticated
router.get('/permissions', (_req, res) => {
  res.json(PERMISSION_GROUPS);
});

router.get('/', requirePermission('roles:view'), rolesController.listRoles);
router.post('/', requirePermission('roles:create'), rolesController.createRole);
router.get('/:id', requirePermission('roles:view'), rolesController.getRole);
router.put('/:id', requirePermission('roles:edit'), rolesController.updateRole);
router.delete('/:id', requirePermission('roles:delete'), rolesController.deleteRole);

export default router;
