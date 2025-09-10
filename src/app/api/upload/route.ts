import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary
    const upload = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ resource_type: "auto" }, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        })
        .end(buffer);
    });

    // Lazy-load libraries inside handler to avoid ENOENT/Turbopack issues
    let text = "";
    try {
      if (file.type === "application/pdf") {
        const pdfParse = require("pdf-parse");
        const data = await pdfParse(buffer);
        text = data.text;
      } else if (
        file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const mammoth = require("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } else if (file.type.startsWith("text/")) {
        text = buffer.toString("utf-8");
      } else {
        text = "Text extraction not supported for this file type.";
      }
    } catch (err) {
      text = "Failed to extract text from document.";
    }

    // Generate ChatGPT prompt
    const prompt = `
You are an expert assistant.
I have the following document content:

${text}

Please summarize it, highlight key points, and explain any important details in clear language.
`;

    // Call OpenAI API
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

    const chatData = await chatResponse.json();
    const reply = chatData.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({
      url: upload.secure_url,
      text,
      chatgpt_summary: reply,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
