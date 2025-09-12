import mongoose, { Schema, Document, Model } from "mongoose";


export interface MemoryDoc {
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MemoryMongoDoc extends Document, Omit<MemoryDoc, "createdAt" | "updatedAt"> {
  createdAt: Date;
  updatedAt: Date;
}


const MemorySchema = new Schema<MemoryMongoDoc>(
  {
    userId: { type: String, required: true },
    role: { type: String, required: true, enum: ["user", "assistant", "system"] },
    content: { type: String, required: true },
  },
  { timestamps: true }
);


const Memory: Model<MemoryMongoDoc> =
  (mongoose.models.Memory as Model<MemoryMongoDoc>) ||
  mongoose.model<MemoryMongoDoc>("Memory", MemorySchema);


export async function getMemoryForUser(
  userId: string,
  limit: number = 50
): Promise<MemoryDoc[]> {
  try {
    const memories = await Memory.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<MemoryDoc[]>(); 
    return memories;
  } catch (err) {
    console.error("❌ Error fetching memory:", err);
    return [];
  }
}


export async function saveMemoryForUser(
  userId: string,
  message: { role: "user" | "assistant" | "system"; content: string }
): Promise<void> {
  try {
    await Memory.create({ userId, ...message });
  } catch (err) {
    console.error("❌ Error saving memory:", err);
  }
}


export async function clearMemoryForUser(userId: string): Promise<void> {
  try {
    await Memory.deleteMany({ userId });
  } catch (err) {
    console.error("❌ Error clearing memory:", err);
  }
}
