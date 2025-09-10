import { NextResponse } from "next/server";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

// Explicitly set the runtime to Node.js
export const runtime = "nodejs";

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// Strongly type OpenAI response
interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // --- Upload file to Cloudinary ---
    const upload: UploadApiResponse = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ resource_type: "auto" }, (error, result) => {
          if (error) reject(error);
          else resolve(result as UploadApiResponse);
        })
        .end(buffer);
    });

    if (!upload?.secure_url) {
      throw new Error("Cloudinary upload failed.");
    }

    // --- Extract text based on file type ---
    let text = "";
    try {
      if (file.type === "application/pdf") {
        const pdfParse = (await import("pdf-parse")).default;
        const data = await pdfParse(buffer);
        text = data.text;
      } else if (
        file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const mammoth = (await import("mammoth")).default;
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } else if (file.type.startsWith("text/")) {
        text = buffer.toString("utf-8");
      } else {
        text = "Text extraction not supported for this file type.";
      }
    } catch (parseError) {
      console.error("Text extraction failed:", parseError);
      text = "Failed to extract text from document.";
    }

    // --- Prepare prompt for ChatGPT ---
    const prompt = `You are an expert assistant.\nSummarize this document, highlight key points, and explain any important details in clear language:\n\n${text}`;

    // --- Call OpenAI API ---
    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const chatData: ChatCompletionResponse = await chatResponse.json();
    const reply = chatData.choices?.[0]?.message?.content ?? "";

    // --- Return Cloudinary URL, extracted text, and AI summary ---
    return NextResponse.json({
      url: upload.secure_url,
      text,
      chatgpt_summary: reply,
    });
  } catch (err: unknown) {
    console.error("Upload error:", err);
    const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
