import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as userPreferenceService from '../services/userPreferenceService.js';

const router = Router();

router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/me/logout', authenticate, userController.logout);
router.get('/me', authenticate, userController.getMe);
router.put('/me', authenticate, userController.updateMe);
router.get('/me/permissions', authenticate, userController.getPermissions);

router.get('/me/preferences', authenticate, async (req, res, next) => {
  try {
    const prefs = await userPreferenceService.getPreferences(req.user.userId);
    res.json(prefs);
  } catch (err) {
    next(err);
  }
});

router.put('/me/preferences', authenticate, async (req, res, next) => {
  try {
    const { favoriteBrands, ingestStationId, useIngestMode } = req.body;
    const prefs = await userPreferenceService.updatePreferences(req.user.userId, {
      favoriteBrands,
      ingestStationId,
      useIngestMode,
    });
    res.json(prefs);
  } catch (err) {
    next(err);
  }
});

// Admin routes
router.post('/', authenticate, requireRole('ADMIN'), userController.createUser);
router.get('/', authenticate, requireRole('ADMIN'), userController.listUsers);
router.get('/:userId', authenticate, requireRole('ADMIN'), userController.getUser);
router.put('/:userId', authenticate, requireRole('ADMIN'), userController.updateUser);
router.delete('/:userId', authenticate, requireRole('ADMIN'), userController.deleteUser);

export default router;
