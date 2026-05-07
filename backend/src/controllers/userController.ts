import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authMiddleware';
import SavedConnection from '../models/SavedConnection';

export const saveConnection = async (req: AuthRequest, res: Response) => {
  // Check if MongoDB is connected
  if (mongoose.connection.readyState !== 1) {
    console.log('DB disconnected, simulating save');
    return res.status(201).json({ _id: 'mock_conn_' + Date.now(), ...req.body });
  }

  try {
    const { name, server, port, username, password } = req.body;
    const userId = req.user.id;

    // Check for unique name per user
    const existingName = await SavedConnection.findOne({ userId, name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingName) {
      return res.status(400).json({ error: `You already have a connection named "${name}". Please use a unique name.` });
    }

    // Check for duplicate technical credentials (Server, Port, Username, Password)
    const duplicate = await SavedConnection.findOne({ userId, server, port, username, password });
    if (duplicate) {
      return res.status(400).json({ error: `This server is already saved in your list as "${duplicate.name}".` });
    }

    const connection = await SavedConnection.create({
      userId,
      name,
      server,
      port,
      username,
      password,
    });

    res.status(201).json(connection);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getSavedConnections = async (req: AuthRequest, res: Response) => {
  // Check if MongoDB is connected
  if (mongoose.connection.readyState !== 1) {
    console.log('DB disconnected, returning mock list');
    return res.json([
      {
        _id: 'mock_conn_1',
        name: 'Demo Production Server',
        server: '5.175.139.84',
        port: 2006,
        username: 'sa'
      }
    ]);
  }

  try {
    const userId = req.user.id;
    const connections = await SavedConnection.find({ userId });
    res.json(connections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateConnection = async (req: AuthRequest, res: Response) => {
  // Check if MongoDB is connected
  if (mongoose.connection.readyState !== 1) {
    console.log('DB disconnected, simulating update');
    return res.json({ _id: req.params.id, ...req.body });
  }

  try {
    const { id } = req.params;
    const { name, server, port, username, password } = req.body;
    const userId = req.user.id;

    // Check if new name is already taken by ANOTHER record
    const existingName = await SavedConnection.findOne({ 
      userId, 
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      _id: { $ne: id }
    });
    
    if (existingName) {
      return res.status(400).json({ error: `Another connection is already named "${name}". Please choose a different name.` });
    }

    // Check if these technical credentials already exist in ANOTHER record
    const duplicate = await SavedConnection.findOne({ 
      userId, server, port, username, password,
      _id: { $ne: id }
    });
    
    if (duplicate) {
      return res.status(400).json({ error: `These credentials already exist for another server named "${duplicate.name}".` });
    }

    const connection = await SavedConnection.findOneAndUpdate(
      { _id: id, userId },
      { name, server, port, username, password },
      { new: true }
    );

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    res.json(connection);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteConnection = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const connection = await SavedConnection.findOneAndDelete({ _id: id, userId });
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    res.json({ message: 'Connection deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
