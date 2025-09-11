import mongoose from "mongoose";

// --- Message Type ---
export interface Message {
  role: "user" | "assistant";
  content: string;
}

// --- Conversation Document Type ---
export interface ConversationDoc extends mongoose.Document {
  userId: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

// --- Define schema ---
const MessageSchema = new mongoose.Schema<Message>(
  {
    role: { type: String, required: true, enum: ["user", "assistant"] },
    content: { type: String, required: true },
  },
  { _id: false }
);

const ConversationSchema = new mongoose.Schema<ConversationDoc>(
  {
    userId: { type: String, required: true },
    messages: [MessageSchema],
  },
  { timestamps: true }
);

// --- Prevent model overwrite in Next.js hot reload ---
const Conversation =
  (mongoose.models && mongoose.models.Conversation) ||
  mongoose.model<ConversationDoc>("Conversation", ConversationSchema);

export default Conversation;
