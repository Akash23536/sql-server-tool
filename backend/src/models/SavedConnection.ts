import mongoose, { Schema, Document } from 'mongoose';

export interface ISavedConnection extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  server: string;
  port: number;
  username: string;
  password: string; // Ideally encrypted, but for now stored as is
  createdAt: Date;
}

const SavedConnectionSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  server: { type: String, required: true },
  port: { type: Number, required: true, default: 1433 },
  username: { type: String, required: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<ISavedConnection>('SavedConnection', SavedConnectionSchema);
