import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/Lib/db";
import Conversation from "@/models/Conversation";
import { getMemoryForUser, saveMemoryForUser } from "@/Lib/mem0";

// ❌ Edge breaks mongoose
// export const runtime = "edge";
export const runtime = "nodejs"; // ✅ use Node.js runtime

// Define a type for message objects to avoid using `any`
interface Message {
  role: string;
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    // Apply the Message type to the destructured request body
    const { messages, userId }: { messages: Message[]; userId: string } =
      await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required in request body" },
        { status: 400 }
      );
    }

    // --- 🧠 Fetch memory ---
    const memory: Message[] = await getMemoryForUser(userId);
    const context = memory
      .map((m: Message) => `${m.role}: ${m.content}`)
      .join("\n");

    // --- 📝 Prepare prompt ---
    const userText = messages
      .map((m: Message) => `${m.role}: ${m.content}`)
      .join("\n");
    const prompt = `${context}\n${userText}`;

    // --- 🤖 Call Google Gemini REST API ---
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
      // Throw a detailed error if the API call fails
      const errorBody = await response.text();
      throw new Error(`Gemini API error: ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "My apologies, I couldn't generate a response.";

    // --- 💾 Save conversation ---
    await Conversation.create({
      userId,
      messages: [...messages, { role: "assistant", content: reply }],
    });

    // --- 💾 Save memory ---
    await saveMemoryForUser(userId, { role: "assistant", content: reply });

    // --- 📤 Return AI reply ---
    return NextResponse.json({ reply });
    
  } catch (err: unknown) {
    console.error("Chat API error:", err);

    let errorMessage = "An internal server error occurred.";
    if (err instanceof Error) {
      // Use the actual error message for more specific client-side errors
      errorMessage = err.message;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}