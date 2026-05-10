import express from 'express';
import { 
  getUsers, 
  getAuditLogs, 
  updateUser, 
  resetUserPassword, 
  deleteUser,
  getUserConnections,
  getUserLogs,
  updateUserConnection,
  createUser,
  addUserConnection,
  deleteUserConnection,
  deleteUserLog,
  clearUserLogs
} from '../controllers/adminController';
import { protect } from '../middleware/authMiddleware';
import { admin } from '../middleware/adminMiddleware';

const router = express.Router();

// All routes here require authentication and admin role
router.use(protect);
router.use(admin);

router.get('/users', getUsers);
router.post('/users', createUser);
router.get('/logs', getAuditLogs);
router.get('/users/:id/connections', getUserConnections);
router.post('/users/:id/connections', addUserConnection);
router.get('/users/:id/logs', getUserLogs);
router.put('/users/:id', updateUser);
router.put('/users/:id/connections/:connectionId', updateUserConnection);
router.delete('/users/:id/connections/:connectionId', deleteUserConnection);
router.put('/users/:id/reset-password', resetUserPassword);
router.delete('/users/:id', deleteUser);
router.delete('/users/:id/logs', clearUserLogs);
router.delete('/users/:id/logs/:logId', deleteUserLog);

export default router;
