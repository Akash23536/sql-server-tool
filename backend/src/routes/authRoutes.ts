import { Router } from 'express';
import mongoose from 'mongoose';
import passport from 'passport';
import { registerUser, loginUser, socialLoginSuccess } from '../controllers/authController';

const router = Router();

// Standard Auth
router.post('/register', registerUser);
router.post('/login', loginUser);

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login', session: false }), socialLoginSuccess);

// GitHub OAuth
router.get('/github', passport.authenticate('github', { scope: ['user:email'], session: false }));
router.get('/github/callback', passport.authenticate('github', { failureRedirect: '/login', session: false }), socialLoginSuccess);

router.get('/status', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.json({ 
    status: isConnected ? 'connected' : 'disconnected',
    message: isConnected ? 'Database is healthy' : 'Database is unreachable'
  });
});

export default router;
