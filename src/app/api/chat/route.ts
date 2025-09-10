import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/Lib/db";
import Conversation from "@/models/Conversation";
import { getMemoryForUser, saveMemoryForUser } from "@/Lib/mem0";

// Node.js runtime is required for Mongoose
export const runtime = "nodejs";

// Strongly type message objects
interface Message {
  role: "user" | "assistant";
  content: string;
}

// Strongly type MongoDB memory document
interface MemoryDoc {
  role: "user" | "assistant";
  content: string;
  _id?: string;
  __v?: number;
}

// Type for Gemini API response candidate
interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    // Parse request body
    const { messages, userId }: { messages: Message[]; userId: string } =
      await req.json();

    if (!userId || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "userId and messages array are required in request body" },
        { status: 400 }
      );
    }

    // --- 🧠 Fetch memory from DB ---
    const rawMemory: MemoryDoc[] = await getMemoryForUser(userId);
    const memory: Message[] = rawMemory.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const context = memory.map((m) => `${m.role}: ${m.content}`).join("\n");

    // --- 📝 Prepare prompt ---
    const userText = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
    const prompt = `${context}\n${userText}`;

    // --- 🤖 Call Google Gemini API ---
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Gemini API error: ${response.status} - ${response.statusText} - ${errorBody}`
      );
    }

    const data: GeminiResponse = await response.json();
    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ??
      "My apologies, I couldn't generate a response.";

    // --- 💾 Save conversation ---
    await Conversation.create({
      userId,
      messages: [...messages, { role: "assistant", content: reply }],
    });

    // --- 💾 Save memory for AI continuity ---
    await saveMemoryForUser(userId, { role: "assistant", content: reply });

    // --- 📤 Return AI reply ---
    return NextResponse.json({ reply });
  } catch (err: unknown) {
    console.error("Chat API error:", err);

    const errorMessage =
      err instanceof Error ? err.message : "An internal server error occurred.";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
