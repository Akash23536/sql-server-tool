import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';

export const admin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user && req.user.role >= 1) {
    next();
  } else {
    res.status(403).json({ error: 'Not authorized as an admin' });
  }
};
