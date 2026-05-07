import { Router } from 'express';
import mongoose from 'mongoose';
import { registerUser, loginUser } from '../controllers/authController';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/status', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.json({ 
    status: isConnected ? 'connected' : 'disconnected',
    message: isConnected ? 'Database is healthy' : 'Database is unreachable'
  });
});

export default router;
