import { NextRequest } from "next/server";
import { connectDB } from "@/Lib/db";
import Conversation from "@/models/Conversation";
import { getMemoryForUser, saveMemoryForUser } from "@/Lib/mem0";

// ❌ Edge breaks mongoose
// export const runtime = "edge";
export const runtime = "nodejs"; // ✅ use Node.js runtime

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const { messages, userId } = await req.json();


    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required in request body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // --- 🧠 Fetch memory ---
    const memory = await getMemoryForUser(userId);
    const context = memory.map((m: any) => `${m.role}: ${m.content}`).join("\n");

    // --- 📝 Prepare prompt ---
    const userText = messages.map((m: any) => `${m.role}: ${m.content}`).join("\n");
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
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";

    // --- 💾 Save conversation ---
    await Conversation.create({
      userId,
      messages: [...messages, { role: "assistant", content: reply }],
    });

    // --- 💾 Save memory ---
    await saveMemoryForUser(userId, { role: "assistant", content: reply });

    // --- 📤 Return AI reply ---
    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: "Chat error" }), {
      status: 500,
    });
  }
}
