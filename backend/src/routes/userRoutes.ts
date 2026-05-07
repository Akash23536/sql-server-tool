import { Router } from 'express';
import * as userController from '../controllers/userController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.post('/saved-connections', protect, userController.saveConnection);
router.get('/saved-connections', protect, userController.getSavedConnections);
router.put('/saved-connections/:id', protect, userController.updateConnection);
router.delete('/saved-connections/:id', protect, userController.deleteConnection);

export default router;
