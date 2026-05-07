import mongoose from 'mongoose';

export const connectMongoDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/sql-server-tool';
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ MongoDB Connected successfully to:', mongoose.connection.host);
  } catch (err: any) {
    console.error(`❌ Error connecting to MongoDB: ${err.message}`);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectMongoDB, 5000);
  }
};
