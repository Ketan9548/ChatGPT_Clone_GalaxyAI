import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/Lib/db";
import Conversation from "@/models/Conversation";
import { getMemoryForUser, saveMemoryForUser } from "@/Lib/mem0";

// Node.js runtime is required for Mongoose
export const runtime = "nodejs";

// --- Type Definitions ---

// Updated to align with Gemini's "model" role for the assistant
type MessageRole = "user" | "assistant" | "model";

interface Message {
  role: MessageRole;
  content: string;
}

// More precise type for the parts of a Gemini API message
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

// Type for the raw document we expect from Mongoose. We only care about these fields.
interface RawMemoryDoc {
    role: string;
    content: string;
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
    // The `getMemoryForUser` function returns raw Mongoose documents.
    // We cast the result to an array of objects with the shape we need, avoiding `any`.
    const rawMemory = (await getMemoryForUser(userId)) as RawMemoryDoc[];
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
            // Using a header for the API key is a common best practice.
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

      
    // 5. --- Save the Conversation Turn to the Database ---
    // Save the user's message and the AI's reply to your long-term storage.
    await Conversation.create({
      userId,
      messages: [...messages, { role: "assistant", content: reply }],
    });

    // Also save the latest reply to the short-term "memory" for the next turn.
    await saveMemoryForUser(userId, { role: "assistant", content: reply });

    // 6. --- Return the AI's Reply ---
    return NextResponse.json({ reply });

  } catch (err: unknown) { // This implementation is perfect!
    console.error("Chat API error:", err);

    const errorMessage =
      err instanceof Error ? err.message : "An internal server error occurred.";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

