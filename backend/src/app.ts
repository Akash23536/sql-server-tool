import express from 'express';
import cors from 'cors';
import path from 'path';
import dbRoutes from './routes/dbRoutes';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', dbRoutes);

// Static Files
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// Catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

export default app;
