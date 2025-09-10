import mongoose from "mongoose";

// 1️⃣ Define schema
const MemorySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    role: { type: String, required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

// 2️⃣ Fix: ensure mongoose.models exists before accessing
const Memory =
  (mongoose.models && mongoose.models.Memory) ||
  mongoose.model("Memory", MemorySchema);

// 3️⃣ Export your helper functions
export async function getMemoryForUser(userId: string) {
  try {
    return await Memory.find({ userId }).lean();
  } catch (err) {
    console.error("❌ Error fetching memory:", err);
    return [];
  }
}

export async function saveMemoryForUser(
  userId: string,
  message: { role: string; content: string }
) {
  try {
    await Memory.create({ userId, ...message });
  } catch (err) {
    console.error("❌ Error saving memory:", err);
  }
}
