import mongoose from "mongoose";


export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationDoc extends mongoose.Document {
  userId: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}


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

const Conversation =
  (mongoose.models && mongoose.models.Conversation) ||
  mongoose.model<ConversationDoc>("Conversation", ConversationSchema);

export default Conversation;
