import { Request, Response } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import AuditLog from '../models/AuditLog';

const generateToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '30d',
  });
};

export const registerUser = async (req: Request, res: Response) => {
  // Check if MongoDB is connected
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ 
      error: 'Database is currently unreachable. Cannot register new users. Please ensure your IP is whitelisted in MongoDB Atlas.' 
    });
  }

  try {
    const { username, email, password } = req.body;

    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      username,
      email,
      passwordHash,
    });

    if (user) {
      // Create audit log
      await AuditLog.create({
        userId: user._id,
        action: 'REGISTER',
        details: 'User registered successfully',
        ipAddress: req.ip
      });

      res.status(201).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        token: generateToken(user._id.toString()),
      });
    } else {
      res.status(400).json({ error: 'Invalid user data' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  console.log('Login attempt:', req.body?.email);
  
  // Check if MongoDB is connected
  if (mongoose.connection.readyState !== 1) {
    // If in development, allow a mock login for testing the UI
    if (process.env.NODE_ENV !== 'production' && req.body.email === 'admin@example.com' && req.body.password === 'admin123') {
      const mockId = '507f1f77bcf86cd799439011';
      console.log('Using mock login for development');
      return res.json({
        _id: mockId,
        username: 'Admin (Dev)',
        email: 'admin@example.com',
        token: jwt.sign({ id: mockId }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' }),
      });
    }

    return res.status(503).json({ 
      error: 'Database is currently unreachable. Please ensure your IP is whitelisted in MongoDB Atlas or check your internet connection. (Dev Tip: use admin@example.com / admin123 to bypass for testing)' 
    });
  }

  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      // Create audit log
      await AuditLog.create({
        userId: user._id,
        action: 'LOGIN',
        details: 'User logged in successfully',
        ipAddress: req.ip
      });

      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        token: generateToken(user._id.toString()),
      });
    } else {
      res.status(401).json({ error: 'Invalid email or password' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
