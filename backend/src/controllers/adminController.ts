import { Request, Response } from 'express';
import User from '../models/User';
import AuditLog from '../models/AuditLog';
import SavedConnection from '../models/SavedConnection';
import bcrypt from 'bcryptjs';

// Get all users
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find({}).select('-passwordHash').sort({ createdAt: -1 });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Create a new user (Admin)
export const createUser = async (req: Request, res: Response) => {
  try {
    const { username, email, password, role, aiRole } = req.body;
    
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) return res.status(400).json({ error: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password || 'password123', salt);

    const user = await User.create({
      username,
      email,
      passwordHash,
      role: role || 0,
      aiRole: aiRole || 'SQL Server Expert'
    });

    res.status(201).json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get all audit logs
export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const logs = await AuditLog.find({}).populate('userId', 'username email').sort({ createdAt: -1 }).limit(500);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update user details (including role)
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { username, email, role, aiRole } = req.body;
    const user = await User.findById(req.params.id);

    if (user) {
      user.username = username || user.username;
      user.email = email || user.email;
      user.role = role !== undefined ? role : user.role;
      user.aiRole = aiRole || user.aiRole;

      const updatedUser = await user.save();
      res.json({
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        aiRole: updatedUser.aiRole,
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Admin reset user password
export const resetUserPassword = async (req: Request, res: Response) => {
  try {
    const { newPassword } = req.body;
    const user = await User.findById(req.params.id);

    if (user) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(newPassword, salt);
      await user.save();

      // Log the action
      await AuditLog.create({
        userId: (req as any).user.id,
        action: 'ADMIN_PASSWORD_RESET',
        details: `Admin reset password for user: ${user.username}`,
        ipAddress: req.ip
      });

      res.json({ message: 'Password reset successfully' });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Delete user
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      // Prevent deleting self
      if (user._id.toString() === (req as any).user.id) {
        return res.status(400).json({ error: 'You cannot delete yourself' });
      }
      
      await user.deleteOne();
      res.json({ message: 'User removed' });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get saved connections for a specific user
export const getUserConnections = async (req: Request, res: Response) => {
  try {
    const connections = await SavedConnection.find({ userId: req.params.id });
    res.json(connections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Update a user's saved connection (Admin)
export const updateUserConnection = async (req: Request, res: Response) => {
  try {
    const { name, server, port, username, password } = req.body;
    const connection = await SavedConnection.findByIdAndUpdate(
      req.params.connectionId,
      { name, server, port, username, password },
      { new: true }
    );
    if (!connection) return res.status(404).json({ error: 'Connection not found' });
    res.json(connection);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Add a saved connection for a user
export const addUserConnection = async (req: Request, res: Response) => {
  try {
    const { name, server, port, username, password } = req.body;
    const connection = await SavedConnection.create({
      userId: req.params.id,
      name,
      server,
      port,
      username,
      password
    });
    res.status(201).json(connection);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a user's saved connection
export const deleteUserConnection = async (req: Request, res: Response) => {
  try {
    const connection = await SavedConnection.findByIdAndDelete(req.params.connectionId);
    if (!connection) return res.status(404).json({ error: 'Connection not found' });
    res.json({ message: 'Connection deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get audit logs for a specific user
export const getUserLogs = async (req: Request, res: Response) => {
  try {
    const logs = await AuditLog.find({ userId: req.params.id }).sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Delete a specific log entry
export const deleteUserLog = async (req: Request, res: Response) => {
  try {
    await AuditLog.findByIdAndDelete(req.params.logId);
    res.json({ message: 'Log entry deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Clear all logs for a user
export const clearUserLogs = async (req: Request, res: Response) => {
  try {
    await AuditLog.deleteMany({ userId: req.params.id });
    res.json({ message: 'All logs for this user cleared' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
