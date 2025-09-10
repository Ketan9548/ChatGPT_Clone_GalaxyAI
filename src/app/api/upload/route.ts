import { NextResponse } from "next/server";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import mammoth  from "mammoth";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// Explicitly set the runtime to Node.js, as these libraries require it.
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Fixed Promise Typing
    const upload = await new Promise<UploadApiResponse | undefined>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ resource_type: "auto" }, (error, result) => {
            if (error) reject(error);
            else resolve(result);
          })
          .end(buffer);
      }
    );

    if (!upload) {
      throw new Error("Cloudinary upload failed.");
    }

    let text = "";
    try {
      // 2. Fixed use of require() with dynamic import()
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

    const prompt = `Summarize the following document: \n\n${text}`;

    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      // ... same fetch options
    });

    const chatData = await chatResponse.json();
    const reply = chatData.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({
      url: upload.secure_url,
      text,
      chatgpt_summary: reply,
    });
  } catch (err: unknown) {
    console.error("Upload error:", err);
    let errorMessage = "An unknown error occurred.";
    if (err instanceof Error) {
      errorMessage = err.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}