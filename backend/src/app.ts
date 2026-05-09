import express from 'express';
import cors from 'cors';
import path from 'path';
import { protect } from './middleware/authMiddleware';
import dbRoutes from './routes/dbRoutes';
import aiRoutes from './routes/aiRoutes';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import { connectMongoDB } from './config/mongoDb';

const app = express();

// Connect to MongoDB
connectMongoDB();

// Startup Checks
if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY === 'your_groq_api_key_here') {
  console.warn('⚠️  [Startup] GROQ_API_KEY is not set or using placeholder. AI features will not work.');
}
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  [Startup] JWT_SECRET is not set. Using default "secret" (Security risk for production).');
}
if (!process.env.MONGO_URI) {
  console.warn('⚠️  [Startup] MONGO_URI is not set. Using local database fallback.');
}

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', protect, userRoutes);
app.use('/api/ai', protect, aiRoutes);
// Connect dbRoutes to /api/sql or similar? No, keep as /api but specific
app.use('/api', protect, dbRoutes);

// Static Files
const frontendPath = path.join(__dirname, '../../frontend/dist');
console.log(`[Production] Serving static files from: ${frontendPath}`);
app.use(express.static(frontendPath));

// Catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

export default app;
