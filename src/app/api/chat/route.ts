import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/Lib/db";
import Conversation from "@/models/Conversation";
import { getMemoryForUser, saveMemoryForUser } from "@/Lib/mem0";

// Node.js runtime is required for Mongoose
export const runtime = "nodejs";

// --- Type Definitions ---
type MessageRole = "user" | "assistant" | "model";

interface Message {
  role: MessageRole;
  content: string;
}

interface GeminiContentPart {
  text: string;
}

interface GeminiMessage {
  role: "user" | "model";
  parts: GeminiContentPart[];
}

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: GeminiContentPart[];
    };
  }[];
}

interface RawMemoryDoc {
  role: string;
  content: string;
}

// --- Helper: Trim conversation to token budget (approx) ---
function trimConversation(messages: Message[], maxTokens = 2000) {
  let tokenCount = 0;
  const trimmed: Message[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    tokenCount += Math.ceil(msg.content.length / 4);
    if (tokenCount > maxTokens) break;
    trimmed.unshift(msg);
  }
  return trimmed;
}

// --- API Route ---
export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const { messages, userId }: { messages: Message[]; userId: string } =
      await req.json();

    if (!userId || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "A userId and a non-empty messages array are required." },
        { status: 400 }
      );
    }

    // --- Fetch user memory ---
    const rawMemoryDocs = await getMemoryForUser(userId);
    const memoryMessages: Message[] = rawMemoryDocs.map((mem) => ({
      role: mem.role === "assistant" ? "assistant" : "user",
      content: mem.content || "",
    }));

    // --- Combine memory + incoming messages ---
    const fullConversation: Message[] = [...memoryMessages, ...messages];

    // --- Trim conversation for token budget ---
    const trimmedConversation = trimConversation(fullConversation);

    // --- Prepare Gemini API input ---
    const contentsForApi: GeminiMessage[] = trimmedConversation.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    // --- Call Gemini API ---
    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({ contents: contentsForApi }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${errText}`);
    }

    const data: GeminiResponse = await geminiResponse.json();
    const aiReply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? "I couldn't generate a response.";

    // --- Save conversation in DB ---
    const existingConversation = await Conversation.findOne({ userId });
    if (existingConversation) {
      existingConversation.messages.push(
        ...messages,
        { role: "assistant", content: aiReply }
      );
      await existingConversation.save();
    } else {
      await Conversation.create({
        userId,
        messages: [...messages, { role: "assistant", content: aiReply }],
      });
    }

    // --- Save to Mem0 ---
    await saveMemoryForUser(userId, { role: "assistant", content: aiReply });

    return NextResponse.json({ reply: aiReply });
  } catch (err: unknown) {
    console.error("Chat API error:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
