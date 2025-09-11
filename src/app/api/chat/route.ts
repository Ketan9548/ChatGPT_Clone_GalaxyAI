import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/Lib/db";
import Conversation from "@/models/Conversation";
import { getMemoryForUser, saveMemoryForUser } from "@/Lib/mem0";


export const runtime = "nodejs";

type MessageRole = "user" | "assistant" | "model";

interface Message {
  role: MessageRole;
  content: string;
}


interface GeminiContentPart {
  text: string;
}

// A structured message for the Gemini API request
interface GeminiMessage {
  role: "user" | "model"; // Gemini API only accepts "user" or "model"
  parts: GeminiContentPart[];
}

// Type for the Gemini API response structure
interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: GeminiContentPart[];
    };
  }[];
}


// --- Main API Route Handler ---

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    // 1. --- Parse and Validate Incoming Request ---
    const { messages, userId }: { messages: Message[]; userId: string } =
      await req.json();

    if (!userId || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "A userId and a non-empty messages array are required." },
        { status: 400 }
      );
    }

    // 2. --- Fetch and Prepare Conversation History ---
    // We assume getMemoryForUser returns documents that can be mapped to our Message interface.
    // This avoids using `any` and keeps our code type-safe.
    const rawMemory: { role: string, content: string }[] = await getMemoryForUser(userId);
    const conversationHistory: Message[] = rawMemory.map((mem) => ({
      role: mem.role as MessageRole,
      content: mem.content,
    }));

    // Combine the fetched history with the new messages from the request
    const fullConversation: Message[] = [...conversationHistory, ...messages];
    
    // 3. --- Construct a Structured Prompt for Gemini ---
    // This is the key change: We build an array of user/model turns.
    // This gives the AI much better context than a single block of text.
    const contentsForApi: GeminiMessage[] = fullConversation.map((message) => ({
        // The Gemini API uses "model" for the assistant's role. We map it here.
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
    }));


    // 4. --- Call the Google Gemini API ---
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
      {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
    
            "x-goog-api-key": process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({ contents: contentsForApi }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorBody}`);
    }

    const data: GeminiResponse = await response.json();
    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ??
      "My apologies, I couldn't generate a response.";

      
    await Conversation.create({
      userId,
      messages: [...messages, { role: "assistant", content: reply }],
    });

    
    await saveMemoryForUser(userId, { role: "assistant", content: reply });


    return NextResponse.json({ reply });

  } catch (err: unknown) {
    console.error("Chat API error:", err);

    const errorMessage =
      err instanceof Error ? err.message : "An internal server error occurred.";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
