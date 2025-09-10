import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    messages: [
      {
        role: { type: String, required: true },
        content: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

// ✅ Always reference mongoose.models directly
const Conversation =
  (mongoose.models && mongoose.models.Conversation) ||
  mongoose.model("Conversation", ConversationSchema);

export default Conversation;
