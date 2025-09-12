import mongoose, { Schema, Document, Model } from "mongoose";

// --- Memory Document Type ---
export interface MemoryDoc {
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

// --- Extend Mongoose Document for type safety ---
interface MemoryMongoDoc extends Document, Omit<MemoryDoc, "createdAt" | "updatedAt"> {
  createdAt: Date;
  updatedAt: Date;
}

// --- Define Mongoose schema ---
const MemorySchema = new Schema<MemoryMongoDoc>(
  {
    userId: { type: String, required: true },
    role: { type: String, required: true, enum: ["user", "assistant", "system"] },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

// --- Prevent model overwrite in Next.js hot reload ---
const Memory: Model<MemoryMongoDoc> =
  (mongoose.models.Memory as Model<MemoryMongoDoc>) ||
  mongoose.model<MemoryMongoDoc>("Memory", MemorySchema);

// --- Fetch memory for a user ---
// Optional `limit` param to trim context for AI
export async function getMemoryForUser(
  userId: string,
  limit: number = 50
): Promise<MemoryDoc[]> {
  try {
    const memories = await Memory.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<MemoryDoc[]>(); // ✅ Fix typing for lean
    return memories;
  } catch (err) {
    console.error("❌ Error fetching memory:", err);
    return [];
  }
}

// --- Save a memory entry ---
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

// --- Optional: clear memory for a user ---
export async function clearMemoryForUser(userId: string): Promise<void> {
  try {
    await Memory.deleteMany({ userId });
  } catch (err) {
    console.error("❌ Error clearing memory:", err);
  }
}
