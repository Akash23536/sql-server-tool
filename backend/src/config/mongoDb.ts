import mongoose from 'mongoose';

export const connectMongoDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/sql-server-tool';
    await mongoose.connect(mongoURI);
    console.log('MongoDB Connected...');
  } catch (err: any) {
    console.error(`Error connecting to MongoDB: ${err.message}`);
    process.exit(1);
  }
};
